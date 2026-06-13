/**
 * POST /api/github/disconnect
 *
 * Disconnects the user's GitHub account:
 * 1. Read the GitHub session from the cookie
 * 2. Attempt to revoke the OAuth grant on GitHub (DELETE /applications/{client_id}/grant)
 * 3. Clear the session cookie
 * 4. Delete the github_connections row from Supabase (best-effort)
 *
 * Revocation uses HTTP Basic Auth with the OAuth app credentials, per GitHub docs.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { readGitHubSession, clearSessionCookie } from "@/lib/github/session";

export async function POST() {
  const cookieStore = await cookies();
  const session = readGitHubSession(cookieStore);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  // ── Revoke OAuth grant on GitHub ─────────────────────────────────────────
  if (session?.accessToken && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    try {
      // GitHub's API to delete an OAuth token (revoke grant for all tokens)
      await fetch(
        `https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/grant`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                `${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`,
              ).toString("base64"),
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: session.accessToken }),
        },
      );
    } catch {
      // Non-fatal: we still clear the local session
    }
  }

  // ── Delete Supabase row ───────────────────────────────────────────────────
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("github_connections")
          .delete()
          .eq("user_id", user.id);
      }
    } catch {
      // Non-fatal
    }
  }

  return response;
}
