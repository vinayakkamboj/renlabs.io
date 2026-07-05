/**
 * GitHub repository loader — seeds a workspace from an existing repository.
 *
 * Fetches the default-branch git tree, filters to text/source files within size
 * and count budgets, and downloads their contents so the build agent can read
 * and edit the real codebase. Binary, vendored, and oversized files are skipped.
 */

import type { ProjectFile } from "./types";

const MAX_FILES = 80;
const MAX_FILE_BYTES = 100_000;

const SKIP_DIRS = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "out/",
  "coverage/",
  "vendor/",
  ".turbo/",
];

// Web source AND backend languages — an attached Python/Java/Go/Rust repo must
// load its real source so the intelligence layer can classify it and Astra can
// read and edit it. Binary formats stay excluded.
const TEXT_EXT =
  /\.(tsx?|jsx?|css|scss|sass|less|html|json|md|mdx|svg|txt|yml|yaml|toml|env|gitignore|prisma|graphql|mjs|cjs|vue|svelte|astro|py|java|kts?|go|rs|rb|php|cs|swift|scala|c|h|cpp|hpp|cc|sql|sh|bash|gradle|properties|xml|ini|cfg|conf|proto|tf|dockerfile|ru|erb|ex|exs)$/i;

// Manifest/config files that matter even without a matching extension.
const KEEP_BASENAMES = new Set([
  "dockerfile",
  "makefile",
  "procfile",
  "gemfile",
  "rakefile",
  "cmakelists.txt",
  "go.mod",
  "go.sum",
  "cargo.toml",
  "requirements.txt",
  "pipfile",
  "gradlew",
]);

interface GitTreeItem {
  path: string;
  type: string;
  size?: number;
  sha: string;
}

function isSkippable(path: string): boolean {
  if (SKIP_DIRS.some((d) => path.startsWith(d) || path.includes("/" + d))) {
    return true;
  }
  if (path.endsWith("package-lock.json") || path.endsWith("pnpm-lock.yaml") || path.endsWith("yarn.lock")) {
    return true;
  }
  const basename = path.split("/").pop()?.toLowerCase() ?? "";
  if (KEEP_BASENAMES.has(basename)) return false;
  return !TEXT_EXT.test(path);
}

async function gh<T>(url: string, token: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json()) as T;
}

/**
 * Load up to MAX_FILES source files from a repository. Returns an empty array if
 * the repo can't be read (revoked token, missing repo, etc.) so callers can fall
 * back to the base template.
 */
export async function loadRepositoryFiles(
  fullName: string,
  defaultBranch: string,
  token: string,
): Promise<ProjectFile[]> {
  const tree = await gh<{ tree: GitTreeItem[]; truncated: boolean }>(
    `https://api.github.com/repos/${fullName}/git/trees/${defaultBranch}?recursive=1`,
    token,
  );
  if (!tree?.tree) return [];

  const candidates = tree.tree
    .filter((i) => i.type === "blob" && !isSkippable(i.path))
    .filter((i) => (i.size ?? 0) <= MAX_FILE_BYTES)
    .slice(0, MAX_FILES);

  const files = await Promise.all(
    candidates.map(async (item) => {
      const blob = await gh<{ content: string; encoding: string }>(
        `https://api.github.com/repos/${fullName}/git/blobs/${item.sha}`,
        token,
      );
      if (!blob || blob.encoding !== "base64") return null;
      try {
        const content = Buffer.from(blob.content, "base64").toString("utf8");
        return { path: item.path, content } satisfies ProjectFile;
      } catch {
        return null;
      }
    }),
  );

  return files.filter((f): f is ProjectFile => f !== null);
}
