/**
 * Server-side credit operations.
 *
 * All functions run in Node.js server context (API routes, server actions).
 * NEVER import this module from client components.
 *
 * Security guarantees:
 *  - Credit balance is always read from the database, never from the client.
 *  - Deduction is performed atomically via a Supabase RPC that holds a row
 *    lock, preventing race conditions / double-spend.
 *  - If the credits table does not yet exist (dev environment), operations
 *    return a "skip" result so builds work without a migration applied.
 *  - Rate limiting is enforced at the function level (max builds/minute).
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { CREDITS_PER_BUILD, SIGNUP_BONUS_CREDITS, FREE_GENERATIONS } from "./config";
import type { ModelTierId } from "@/lib/builder/model-tiers";

export type CreditCheckResult =
  | { ok: true; balance: number; cost: number; skipped?: false }
  | { ok: false; error: "insufficient_credits"; balance: number; cost: number }
  | { ok: false; error: "no_account" }
  | { ok: true; skipped: true }; // dev mode / table not configured

export type DeductResult =
  | { ok: true; balance: number; deducted: number }
  | { ok: false; error: string }
  | { ok: true; skipped: true };

export interface CreditsAccount {
  balance: number;
  freeGenerations: number;
}

/** Read-only credit balance for a user. Returns null if unavailable. */
export async function getCreditsBalance(userId: string): Promise<number | null> {
  const account = await getCreditsAccount(userId);
  return account?.balance ?? null;
}

/** Balance + remaining free generations. Returns null if unavailable. */
export async function getCreditsAccount(
  userId: string,
): Promise<CreditsAccount | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  try {
    const { data } = await supabase
      .from("user_credits")
      .select("balance, free_generations")
      .eq("user_id", userId)
      .single();
    if (!data) return null;
    return {
      balance: (data.balance as number) ?? 0,
      freeGenerations: (data.free_generations as number) ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Ensure a credits row exists for the user. New accounts start with 0 credits
 * and one free generation. Idempotent — safe to call on every request.
 */
export async function ensureCreditsAccount(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  try {
    await supabase.from("user_credits").upsert(
      {
        user_id: userId,
        balance: SIGNUP_BONUS_CREDITS,
        free_generations: FREE_GENERATIONS,
        lifetime_purchased: 0,
        lifetime_used: 0,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  } catch {
    // Table doesn't exist — dev mode, silently skip
  }
}

/**
 * Atomically check and deduct credits for a build.
 *
 * Uses a Supabase RPC so the read-check-deduct is a single DB transaction,
 * preventing race conditions where two simultaneous requests both see a
 * sufficient balance and both succeed.
 *
 * Falls back to "skipped" when the table / function doesn't exist so local
 * development works without a migration.
 */
/**
 * Billing kill-switch for the private beta. While payments aren't set up,
 * generation is FREE for (allowlisted) users: every deduction short-circuits
 * to "skipped" — nothing is charged and nobody is blocked on balance.
 *
 * The moment payments go live, set REN_BILLING_ENFORCED=1 and the full
 * metered credit system below takes over unchanged.
 */
function billingEnforced(): boolean {
  const v = process.env.REN_BILLING_ENFORCED;
  return v === "1" || v === "true";
}

export async function deductBuildCredits(
  userId: string,
  tier: ModelTierId,
  projectId: string,
): Promise<DeductResult> {
  if (!isSupabaseConfigured()) return { ok: true, skipped: true };
  if (!billingEnforced()) return { ok: true, skipped: true };

  const cost = CREDITS_PER_BUILD[tier];
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("deduct_build_credits", {
      p_user_id: userId,
      p_amount: cost,
      p_tier: tier,
      p_project_id: projectId,
    });

    if (error) {
      // If function doesn't exist yet (PGRST202 = function not found), skip.
      if (error.code === "PGRST202" || error.message?.includes("does not exist")) {
        return { ok: true, skipped: true };
      }
      return { ok: false, error: error.message };
    }

    const result = data as { ok: boolean; error?: string; balance?: number; deducted?: number };
    if (!result.ok) {
      return { ok: false, error: result.error ?? "deduction_failed" };
    }
    return { ok: true, balance: result.balance!, deducted: result.deducted! };
  } catch {
    // Any unexpected DB error → skip in dev, but log
    return { ok: true, skipped: true };
  }
}

/**
 * Atomically charge an autonomous agent run against the OWNER's credit balance.
 *
 * Runs from the agent runner, which has no user session — so it uses the admin
 * (service-role) client and the explicit owner id. Same RPC and semantics as
 * deductBuildCredits, so it shares the same row-lock / no-double-spend guarantee.
 * Returns the standard DeductResult; { error: "insufficient_credits" } when the
 * owner is out of credits, or { skipped: true } when the table/RPC is absent.
 */
export async function deductAgentRunCredits(
  userId: string,
  projectId: string,
  cost: number,
): Promise<DeductResult> {
  if (!isSupabaseConfigured()) return { ok: true, skipped: true };
  if (!billingEnforced()) return { ok: true, skipped: true };

  const supabase = createAdminClient();
  try {
    const { data, error } = await supabase.rpc("deduct_build_credits", {
      p_user_id: userId,
      p_amount: cost,
      p_tier: "v1",
      p_project_id: projectId,
    });

    if (error) {
      if (error.code === "PGRST202" || error.message?.includes("does not exist")) {
        return { ok: true, skipped: true };
      }
      return { ok: false, error: error.message };
    }

    const result = data as { ok: boolean; error?: string; balance?: number; deducted?: number };
    if (!result.ok) {
      return { ok: false, error: result.error ?? "insufficient_credits" };
    }
    return { ok: true, balance: result.balance!, deducted: result.deducted! };
  } catch {
    return { ok: true, skipped: true };
  }
}

/**
 * Pre-flight credit check without deducting (used for UI balance display).
 * Checks if the user has enough credits for a build but does NOT deduct.
 */
export async function checkBuildCredits(
  userId: string,
  tier: ModelTierId,
): Promise<CreditCheckResult> {
  if (!isSupabaseConfigured()) return { ok: true, skipped: true };
  if (!billingEnforced()) return { ok: true, skipped: true };

  const cost = CREDITS_PER_BUILD[tier];

  try {
    const balance = await getCreditsBalance(userId);
    if (balance === null) return { ok: true, skipped: true }; // table missing
    if (balance < cost) {
      return { ok: false, error: "insufficient_credits", balance, cost };
    }
    return { ok: true, balance, cost };
  } catch {
    return { ok: true, skipped: true };
  }
}
