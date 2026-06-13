/**
 * GET /api/github/callback
 *
 * OAuth callback handler for GitHub repository access.
 *
 * Flow:
 * 1. Verify CSRF state (compare cookie vs query param)
 * 2. Exchange authorization code for an access token
 * 3. Fetch the authenticated GitHub user profile
 * 4. Store encrypted session in an httpOnly cookie
 * 5. Upsert the github_connections row in Supabase
 * 6. Redirect to returnTo with ?github=connected
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  decodeOAuthState,
  readStateCookie,
  statesMatch,
  setSessionCookie,
  clearStateCookie,
  normalizeReturnTo,
  type GitHubSession,
} from "@/lib/github/session";

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const errorRedirect = (reason: string) =>
    NextResponse.redirect(
      `${origin}/dashboard/integrations?github_error=${encodeURIComponent(reason)}`,
    );

  // ── 1. Read CSRF state from cookie ────────────────────────────────────────
  const cookieStore = await cookies();
  const cookieState = readStateCookie(cookieStore);
  if (!cookieState) {
    return errorRedirect("missing_state");
  }

  // ── 2. Verify CSRF state from query param ─────────────────────────────────
  const rawState = searchParams.get("state");
  if (!rawState) {
    return errorRedirect("missing_state_param");
  }

  let callbackState;
  try {
    callbackState = decodeOAuthState(rawState);
  } catch {
    return errorRedirect("invalid_state");
  }

  if (!statesMatch(cookieState, callbackState)) {
    return errorRedirect("state_mismatch");
  }

  // ── 3. Check for OAuth error from GitHub ──────────────────────────────────
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const desc = searchParams.get("error_description") ?? oauthError;
    const response = errorRedirect(encodeURIComponent(desc));
    clearStateCookie(response);
    return response;
  }

  const code = searchParams.get("code");
  if (!code) {
    return errorRedirect("missing_code");
  }

  // ── 4. Exchange code for access token ─────────────────────────────────────
  let tokenData: GitHubTokenResponse;
  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${origin}/api/github/callback`,
        }),
      },
    );

    if (!tokenRes.ok) {
      return errorRedirect("token_exchange_failed");
    }

    tokenData = (await tokenRes.json()) as GitHubTokenResponse;
  } catch {
    return errorRedirect("token_exchange_error");
  }

  if (tokenData.error || !tokenData.access_token) {
    return errorRedirect(
      tokenData.error_description ?? tokenData.error ?? "token_error",
    );
  }

  const accessToken = tokenData.access_token;
  const scope = tokenData.scope ?? "";

  // ── 5. Fetch GitHub user profile ──────────────────────────────────────────
  let githubUser: GitHubUserResponse;
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!userRes.ok) {
      return errorRedirect("github_user_fetch_failed");
    }

    githubUser = (await userRes.json()) as GitHubUserResponse;
  } catch {
    return errorRedirect("github_user_fetch_error");
  }

  // ── 6. Build session and encrypt into cookie ──────────────────────────────
  const session: GitHubSession = {
    accessToken,
    login: githubUser.login,
    scope,
    connectedAt: new Date().toISOString(),
  };

  const returnTo = normalizeReturnTo(cookieState.returnTo);
  const redirectUrl = new URL(`${origin}${returnTo}`);
  redirectUrl.searchParams.set("github", "connected");

  const response = NextResponse.redirect(redirectUrl.toString());
  setSessionCookie(response, session);
  clearStateCookie(response);

  // ── 7. Upsert github_connections in Supabase (best-effort) ───────────────
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("github_connections").upsert(
          {
            user_id: user.id,
            github_login: githubUser.login,
            scopes: scope ? scope.split(",").map((s) => s.trim()) : [],
            connected_at: session.connectedAt,
          },
          { onConflict: "user_id" },
        );
      }
    } catch {
      // Non-fatal: session cookie is the source of truth for UI
    }
  }

  return response;
}
