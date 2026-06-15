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
  getGitHubAppSlug,
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

  // Use NEXT_PUBLIC_APP_URL if set so the redirect_uri is always the canonical
  // production URL, not the request origin (which can be a Vercel preview URL
  // or localhost, causing GitHub to reject the callback).
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? origin;

  // ── 5. Build the authorization URL ────────────────────────────────────────
  const appSlug = getGitHubAppSlug();
  let redirectTarget: string;

  if (appSlug) {
    // GitHub App mode: send the user to INSTALL the app (and authorize during
    // install). This is required so the app gains access to the user's repos —
    // a plain authorization isn't enough for a GitHub App. With "Request user
    // authorization (OAuth) during installation" enabled, GitHub redirects back
    // to our callback with both `installation_id` and an OAuth `code`.
    const installUrl = new URL(
      `https://github.com/apps/${appSlug}/installations/new`,
    );
    installUrl.searchParams.set("state", encodedState);
    redirectTarget = installUrl.toString();
  } else {
    // OAuth App mode: classic authorize flow with explicit scopes.
    // `repo` (full repo control), `workflow` (push .github/workflows), profile.
    const scopes =
      process.env.GITHUB_OAUTH_SCOPES ?? "repo workflow read:user user:email";
    const githubUrl = new URL("https://github.com/login/oauth/authorize");
    githubUrl.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
    githubUrl.searchParams.set("redirect_uri", `${appOrigin}/api/github/callback`);
    githubUrl.searchParams.set("scope", scopes);
    githubUrl.searchParams.set("state", encodedState);
    githubUrl.searchParams.set("allow_signup", "false");
    redirectTarget = githubUrl.toString();
  }

  // ── 6. Store state cookie and redirect ────────────────────────────────────
  const response = NextResponse.redirect(redirectTarget);
  setStateCookie(response, state);

  return response;
}
