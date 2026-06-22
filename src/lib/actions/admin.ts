"use server";

import { revalidatePath } from "next/cache";
import {
  requireCreditsAccess,
  requireSuperAdmin,
} from "@/lib/auth/admin";
import { createAdminClient, isAdminDbConfigured } from "@/lib/supabase/admin";
import type { AssignableRole } from "@/lib/auth/roles";
import { ASSIGNABLE_ROLES } from "@/lib/auth/roles";

type Result = { ok: true } | { ok: false; error: string };

/** Append an audit entry. Best-effort — never blocks the primary action. */
async function audit(
  actorId: string,
  actorEmail: string,
  action: string,
  targetUserId: string | null,
  detail: Record<string, unknown>,
) {
  try {
    const db = createAdminClient();
    await db.from("admin_audit_log").insert({
      actor_id: actorId,
      actor_email: actorEmail,
      action,
      target_user_id: targetUserId,
      detail,
    });
  } catch {
    /* audit is best-effort */
  }
}

/**
 * Grant (positive) or deduct (negative) credits for a user.
 * Requires: support role or higher.
 */
export async function adminGrantCredits(
  targetUserId: string,
  amount: number,
  note: string,
): Promise<Result> {
  let admin;
  try {
    admin = await requireCreditsAccess();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  if (!isAdminDbConfigured()) {
    return { ok: false, error: "Service role key not configured on the server." };
  }
  if (!Number.isInteger(amount) || amount === 0) {
    return { ok: false, error: "Enter a non-zero whole number of credits." };
  }
  if (Math.abs(amount) > 1_000_000) {
    return { ok: false, error: "Amount is too large." };
  }

  const db = createAdminClient();
  const { error } = await db.rpc("admin_grant_credits", {
    p_user_id: targetUserId,
    p_amount: amount,
    p_note: note.slice(0, 200),
    p_actor: admin.email,
  });
  if (error) return { ok: false, error: error.message };

  await audit(admin.id, admin.email, "grant_credits", targetUserId, { amount, note });
  revalidatePath(`/admin/users/${targetUserId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Set a user's remaining free build generations.
 * Requires: support role or higher.
 */
export async function adminSetFreeGenerations(
  targetUserId: string,
  count: number,
): Promise<Result> {
  let admin;
  try {
    admin = await requireCreditsAccess();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  if (!isAdminDbConfigured()) {
    return { ok: false, error: "Service role key not configured on the server." };
  }
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    return { ok: false, error: "Enter a whole number between 0 and 1000." };
  }

  const db = createAdminClient();
  const { error } = await db.rpc("admin_set_free_generations", {
    p_user_id: targetUserId,
    p_count: count,
  });
  if (error) return { ok: false, error: error.message };

  await audit(admin.id, admin.email, "set_free_generations", targetUserId, { count });
  revalidatePath(`/admin/users/${targetUserId}`);
  return { ok: true };
}

/**
 * Change a user's role.
 * Requires: superadmin only — no one else can promote or demote users.
 */
export async function adminSetRole(
  targetUserId: string,
  role: AssignableRole,
): Promise<Result> {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Superadmin only." };
  }
  if (!isAdminDbConfigured()) {
    return { ok: false, error: "Service role key not configured on the server." };
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { ok: false, error: "Invalid role." };
  }

  const db = createAdminClient();
  const { error } = await db.from("profiles").update({ role }).eq("id", targetUserId);
  if (error) return { ok: false, error: error.message };

  await audit(admin.id, admin.email, "set_role", targetUserId, { role });
  revalidatePath(`/admin/users/${targetUserId}`);
  return { ok: true };
}
