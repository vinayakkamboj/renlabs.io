/**
 * GET /api/github/repositories
 *
 * Lists the authenticated user's GitHub repositories (owned + collaborator).
 * Requires a valid GitHub session cookie (obtained via /api/github/connect).
 *
 * Response:
 * {
 *   repositories: Array<{
 *     id: number;
 *     fullName: string;
 *     description: string | null;
 *     private: boolean;
 *     defaultBranch: string;
 *     language: string | null;
 *     updatedAt: string;
 *     stargazersCount: number;
 *     url: string;
 *   }>
 * }
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readGitHubSession } from "@/lib/github/session";

interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  language: string | null;
  updated_at: string;
  stargazers_count: number;
  html_url: string;
}

export async function GET() {
  const cookieStore = await cookies();
  const session = readGitHubSession(cookieStore as any);

  if (!session) {
    return NextResponse.json(
      { error: "GitHub not connected" },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        // Next.js: don't cache this — it changes frequently
        cache: "no-store",
      },
    );

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json(
          { error: "GitHub token expired or revoked" },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: "GitHub API error", status: res.status },
        { status: 502 },
      );
    }

    const repos = (await res.json()) as GitHubRepo[];

    const mapped = repos.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      defaultBranch: r.default_branch,
      language: r.language,
      updatedAt: r.updated_at,
      stargazersCount: r.stargazers_count,
      url: r.html_url,
    }));

    return NextResponse.json({ repositories: mapped });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 },
    );
  }
}
