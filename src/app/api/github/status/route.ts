/**
 * GET /api/github/status
 *
 * Returns the current GitHub connection status for the authenticated user.
 * Used by client components to show connected / disconnected state without
 * requiring a full page navigation.
 *
 * Response shape:
 * {
 *   configured: boolean;  // GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET are set
 *   connected: boolean;   // valid encrypted session cookie exists
 *   login: string | null;
 *   scopes: string[];
 *   connectedAt: string | null;
 * }
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isGitHubConfigured, readGitHubSession } from "@/lib/github/session";

export async function GET() {
  const configured = isGitHubConfigured();
  const cookieStore = await cookies();
  const session = readGitHubSession(cookieStore as any);

  return NextResponse.json({
    configured,
    connected: session !== null,
    login: session?.login ?? null,
    scopes: session?.scope ? session.scope.split(",").map((s) => s.trim()) : [],
    connectedAt: session?.connectedAt ?? null,
  });
}
