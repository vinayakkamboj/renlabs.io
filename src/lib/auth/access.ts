/**
 * Access resolution for the private beta — static allowlist + DB grants.
 *
 * A user may use Ren when EITHER:
 *   1. their email passes the static allowlist (@renlabs.io, owner, env), or
 *   2. an admin approved their trial request (access_requests.status =
 *      'approved') at admin.renlabs.io/access.
 *
 * Works with any Supabase client (session-scoped server client, the edge
 * middleware client, or the service-role admin client) — the query only reads
 * the caller's own row, which RLS permits for session clients.
 */

import { isEmailAllowed } from "./allowlist";

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
