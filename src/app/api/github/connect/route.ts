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
  // `repo`     — full read/write on the connecting user's repos (create, push, manage)
  // `workflow` — allow pushing files under .github/workflows (rejected otherwise)
  // `read:user`/`user:email` — profile + email for the connection record
  // Each user grants this for THEIR OWN account when they click Connect — GitHub
  // has no mechanism to grant blanket access to other people's accounts.
  const scopes =
    process.env.GITHUB_OAUTH_SCOPES ?? "repo workflow read:user user:email";

  // Use NEXT_PUBLIC_APP_URL if set so the redirect_uri is always the canonical
  // production URL, not the request origin (which can be a Vercel preview URL
  // or localhost, causing GitHub to reject the callback).
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? origin;

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  githubUrl.searchParams.set(
    "redirect_uri",
    `${appOrigin}/api/github/callback`,
  );
  githubUrl.searchParams.set("scope", scopes);
  githubUrl.searchParams.set("state", encodedState);
  githubUrl.searchParams.set("allow_signup", "false");

  // ── 6. Store state cookie and redirect ────────────────────────────────────
  const response = NextResponse.redirect(githubUrl.toString());
  setStateCookie(response, state);

  return response;
}
