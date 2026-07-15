/**
 * Access resolution — open by default, private beta available as a switch.
 *
 * OPEN ACCESS (default): anyone who creates an account may use Ren. Their
 * first generation is free (FREE_GENERATIONS in credits/config + the
 * deduct_build_credits RPC consumes it before balance), and billing applies
 * after that only when REN_BILLING_ENFORCED=1.
 *
 * PRIVATE BETA (set REN_PRIVATE_BETA=1): the previous gate — a user may use
 * Ren when EITHER their email passes the static allowlist (@renlabs.io,
 * owner, env) OR an admin approved their trial request at
 * admin.renlabs.io/access. The request flow and the /admin/access dashboard
 * stay live in both modes, so trial requests always land in the admin panel.
 *
 * Works with any Supabase client (session-scoped server client, the edge
 * middleware client, or the service-role admin client) — the query only reads
 * the caller's own row, which RLS permits for session clients.
 */

import { isEmailAllowed } from "./allowlist";

/** True when the private-beta gate is switched on. Default: open access. */
function privateBetaEnforced(): boolean {
  const v = process.env.REN_PRIVATE_BETA;
  return v === "1" || v === "true";
}

/** Minimal structural slice of a Supabase client. Kept deliberately loose
 *  (thenable, not Promise) and applied via an internal cast — the generic
 *  SupabaseClient types from three different packages (server, ssr/edge,
 *  admin) otherwise blow up structural comparison. */
interface QueryClient {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: string,
      ): {
        maybeSingle(): PromiseLike<{ data: { status?: string } | null }>;
      };
    };
  };
}

export async function isUserAllowed(
  client: unknown,
  userId: string | null | undefined,
  email: string | null | undefined,
): Promise<boolean> {
  // Open access: every signed-in account is allowed. The rest of this
  // function only runs when the private-beta switch is explicitly on.
  if (!privateBetaEnforced()) return true;
  if (isEmailAllowed(email)) return true;
  if (!userId) return false;
  try {
    const { data } = await (client as QueryClient)
      .from("access_requests")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.status === "approved";
  } catch {
    // Table missing (migration not applied) or transient DB error — fall back
    // to the static allowlist verdict, which is already false here.
    return false;
  }
}
