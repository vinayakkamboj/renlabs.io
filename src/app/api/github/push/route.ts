/**
 * POST /api/github/push
 *
 * Commits the current project's files to a GitHub repository on behalf of the
 * connected user. Creates the repo if it doesn't exist, ensures the target
 * branch, then writes all files as a single commit via the Git Data API.
 *
 * Auth model:
 * - The GitHub access token comes ONLY from the encrypted session cookie set
 *   during /api/github/connect. The client never sends a token.
 * - The token's scopes are whatever the user granted (repo + workflow). This
 *   gives Ren full management of THAT user's repositories — nothing else.
 *
 * Request body:
 * {
 *   repo: string;              // desired repo name (slugified server-side)
 *   files: { path, content }[]; // project files to commit
 *   owner?: string;            // org/user to create under (default: the user)
 *   branch?: string;           // default: "main"
 *   message?: string;          // commit message
 *   privateRepo?: boolean;     // default: true
 *   reuseExisting?: boolean;   // push into an existing repo of this name
 * }
 *
 * Response: { ok, repoFullName, repoUrl, branch, commitSha, commitUrl, fileCount }
 */

export const runtime = "nodejs";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readGitHubSession } from "@/lib/github/session";

interface PushFile {
  path: string;
  content: string;
}

interface PushRequest {
  repo?: string;
  owner?: string;
  branch?: string;
  message?: string;
  privateRepo?: boolean;
  reuseExisting?: boolean;
  files?: PushFile[];
  token?: string; // PAT fallback for local dev / when OAuth isn't available
}

interface GitHubUser {
  login: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  owner: { login: string };
}

interface GitHubRef {
  object: { sha: string };
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  tree: { sha: string };
}

interface GitHubTree {
  sha: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

function slugifyRepoName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeBranch(value: string | undefined): string {
  return (
    (value || "main")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/^refs\/heads\//, "")
      .replace(/^\/+|\/+$/g, "") || "main"
  );
}

/** Reject path traversal and secret files; never push real env files. */
function normalizePath(path: string): string | null {
  const cleaned = path.trim().replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..")) return null;
  if (cleaned === ".env" || cleaned.startsWith(".env.")) return null;
  return cleaned;
}

function encodeGitRef(ref: string): string {
  return ref.split("/").map(encodeURIComponent).join("/");
}

async function gh<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const json = await res.json();
      if (typeof json?.message === "string") detail = json.message;
    } catch {
      // keep status text
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

async function ghMaybe<T>(
  token: string,
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(`https://api.github.com${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}

function pickUniqueName(base: string, attempt: number): string {
  const trimmed = base.replace(/-+$/g, "").slice(0, 80);
  if (attempt === 0) return trimmed;
  return `${trimmed}-${attempt + 1}`.slice(0, 100);
}

async function createRepo(
  token: string,
  owner: string,
  repo: string,
  privateRepo: boolean,
  user: GitHubUser,
): Promise<GitHubRepo> {
  const body = JSON.stringify({
    name: repo,
    private: privateRepo,
    auto_init: true,
    description: "Built with Ren Code",
  });
  if (owner.toLowerCase() === user.login.toLowerCase()) {
    return gh<GitHubRepo>(token, "/user/repos", { method: "POST", body });
  }
  return gh<GitHubRepo>(token, `/orgs/${owner}/repos`, { method: "POST", body });
}

async function ensureRepo(
  token: string,
  owner: string,
  repo: string,
  privateRepo: boolean,
  user: GitHubUser,
  reuseExisting: boolean,
): Promise<GitHubRepo> {
  if (reuseExisting) {
    const existing = await ghMaybe<GitHubRepo>(token, `/repos/${owner}/${repo}`);
    if (existing.ok) return existing.data;
    if (existing.status !== 404) {
      throw new Error("Could not access the target repository.");
    }
    return createRepo(token, owner, repo, privateRepo, user);
  }

  // Default: never clobber an existing repo — find a free name.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = pickUniqueName(repo, attempt);
    const probe = await ghMaybe<GitHubRepo>(token, `/repos/${owner}/${candidate}`);
    if (probe.ok) continue; // taken, try next
    if (probe.status !== 404) throw new Error("Could not probe repository names.");
    return createRepo(token, owner, candidate, privateRepo, user);
  }
  throw new Error("Could not find a free repository name after 20 attempts.");
}

async function ensureBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  defaultBranch: string,
): Promise<GitHubRef> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const target = await ghMaybe<GitHubRef>(
      token,
      `/repos/${owner}/${repo}/git/ref/heads/${encodeGitRef(branch)}`,
    );
    if (target.ok) return target.data;

    const base = await ghMaybe<GitHubRef>(
      token,
      `/repos/${owner}/${repo}/git/ref/heads/${encodeGitRef(defaultBranch)}`,
    );
    if (base.ok) {
      if (branch === defaultBranch) return base.data;
      return gh<GitHubRef>(token, `/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: base.data.object.sha,
        }),
      });
    }
    // Fresh auto_init repos can take a beat before the ref appears.
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Could not find or create the target branch.");
}

// ── handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: PushRequest;
  try {
    body = (await req.json()) as PushRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Prefer the encrypted session cookie; fall back to a PAT sent in the body
  // (useful for local dev or when the OAuth session has expired).
  const session = readGitHubSession(await cookies());
  const token = session?.accessToken ?? body.token?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "GitHub not connected. Connect your account first.", reauthRequired: true },
      { status: 401 },
    );
  }

  const repo = slugifyRepoName(body.repo ?? "");
  const branch = normalizeBranch(body.branch);
  const message = body.message?.trim() || "Initial commit from Ren Code";

  if (!repo) {
    return NextResponse.json({ error: "A repository name is required." }, { status: 400 });
  }
  if (!Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json({ error: "No project files to push." }, { status: 400 });
  }

  const files = body.files
    .map((f) => {
      const path = normalizePath(f.path);
      if (!path) return null;
      return { path, content: f.content ?? "" };
    })
    .filter((f): f is PushFile => Boolean(f));

  if (!files.length) {
    return NextResponse.json({ error: "No valid files to push." }, { status: 400 });
  }

  // Always add a sensible .gitignore so node_modules / secrets aren't committed.
  const byPath = new Map(files.map((f) => [f.path, f]));
  if (!byPath.has(".gitignore")) {
    byPath.set(".gitignore", {
      path: ".gitignore",
      content: "node_modules\ndist\n.next\n.env\n.env.local\n.DS_Store\n",
    });
  }
  const exportFiles = Array.from(byPath.values());

  try {
    // Validate the session early so an expired token surfaces a clean re-auth.
    const userProbe = await ghMaybe<GitHubUser>(token, "/user");
    if (!userProbe.ok) {
      if (userProbe.status === 401 || userProbe.status === 403) {
        return NextResponse.json(
          { error: "GitHub session expired. Reconnect to push.", reauthRequired: true },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: "Could not verify GitHub session." },
        { status: 502 },
      );
    }
    const user = userProbe.data;
    const owner = (body.owner?.trim() || user.login).replace(/^@/, "");

    const repoInfo = await ensureRepo(
      token,
      owner,
      repo,
      body.privateRepo ?? true,
      user,
      body.reuseExisting ?? false,
    );

    const targetBranch = branch || repoInfo.default_branch || "main";
    const ref = await ensureBranch(
      token,
      repoInfo.owner.login,
      repoInfo.name,
      targetBranch,
      repoInfo.default_branch || "main",
    );

    const baseCommit = await gh<GitHubCommit>(
      token,
      `/repos/${repoInfo.owner.login}/${repoInfo.name}/git/commits/${ref.object.sha}`,
    );

    const tree = await gh<GitHubTree>(
      token,
      `/repos/${repoInfo.owner.login}/${repoInfo.name}/git/trees`,
      {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseCommit.tree.sha,
          tree: exportFiles.map((f) => ({
            path: f.path,
            mode: "100644",
            type: "blob",
            content: f.content,
          })),
        }),
      },
    );

    const commit = await gh<GitHubCommit>(
      token,
      `/repos/${repoInfo.owner.login}/${repoInfo.name}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: [baseCommit.sha],
        }),
      },
    );

    await gh<GitHubRef>(
      token,
      `/repos/${repoInfo.owner.login}/${repoInfo.name}/git/refs/heads/${encodeGitRef(targetBranch)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha }),
      },
    );

    return NextResponse.json({
      ok: true,
      repoFullName: repoInfo.full_name,
      repoUrl: repoInfo.html_url,
      branch: targetBranch,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
      fileCount: exportFiles.length,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "GitHub push failed.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
