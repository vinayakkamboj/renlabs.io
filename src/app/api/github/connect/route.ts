/**
 * GET /api/github/connect?returnTo=/dashboard/something
 *
 * Starts the GitHub OAuth flow for repository access.
 * This is separate from Supabase auth — users must already be signed in
 * via Supabase before they can connect GitHub here.
 *
 * Flow:
 * 1. Verify Supabase is configured and the user is authenticated
 * 2. Create a CSRF state, store it in an httpOnly cookie
 * 3. Redirect the browser to GitHub's OAuth authorization endpoint
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  isGitHubConfigured,
  createOAuthState,
  setStateCookie,
  encodeOAuthState,
  normalizeReturnTo,
} from "@/lib/github/session";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // ── 1. Guard: Supabase must be configured ─────────────────────────────────
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${origin}/dashboard/integrations?github_error=supabase_not_configured`,
    );
  }

  // ── 2. Guard: GitHub OAuth app must be configured ─────────────────────────
  if (!isGitHubConfigured()) {
    return NextResponse.redirect(
      `${origin}/dashboard/integrations?github_error=github_not_configured`,
    );
  }

  // ── 3. Guard: user must be authenticated via Supabase ─────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(`${origin}/login`);
    loginUrl.searchParams.set("next", "/dashboard/integrations");
    return NextResponse.redirect(loginUrl.toString());
  }

  // ── 4. Build CSRF state ───────────────────────────────────────────────────
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"));
  const state = createOAuthState(returnTo);
  const encodedState = encodeOAuthState(state);

  // ── 5. Build GitHub authorization URL ────────────────────────────────────
  const scopes =
    process.env.GITHUB_OAUTH_SCOPES ?? "repo read:user user:email";

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  githubUrl.searchParams.set(
    "redirect_uri",
    `${origin}/api/github/callback`,
  );
  githubUrl.searchParams.set("scope", scopes);
  githubUrl.searchParams.set("state", encodedState);
  githubUrl.searchParams.set("allow_signup", "false");

  // ── 6. Store state cookie and redirect ────────────────────────────────────
  const response = NextResponse.redirect(githubUrl.toString());
  setStateCookie(response, state);

  return response;
}
