/**
 * POST /api/builder/analyze-repo
 *
 * Layer 2 of the repository preview intelligence: Astra reads the attached
 * repository (file manifest + key files) and decides what it IS — frontend,
 * backend, library — whether it can be previewed in the browser, how to run
 * it, and whether to offer building a frontend for it.
 *
 * Error-proofing contract: this endpoint NEVER breaks the workspace.
 *   · Every failure path (no model configured, model error, timeout,
 *     unparseable output) returns HTTP 200 with the deterministic heuristic
 *     profile, so the client always has a valid decision to render.
 *   · Astra's raw verdict is validated field-by-field by `mergeAstraVerdict`,
 *     and the capability gate means a hallucinated "previewable" can never
 *     make the sandbox run something it can't.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { completeAstraText, isAstraConfigured } from "@/lib/ai/astra";
import {
  heuristicRepoProfile,
  mergeAstraVerdict,
  type AstraRepoVerdict,
  type RepoPreviewProfile,
} from "@/lib/builder/repo-preview-intel";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProjectFile } from "@/lib/builder/types";

const MAX_FILES = 400;
const MANIFEST_PATHS = 300;
const KEY_FILE_CHARS = 1_600;
const TOTAL_KEY_CHARS = 14_000;

// Files whose CONTENT (not just path) is worth showing the model — manifests,
// entrypoints, and docs that reveal what the project is.
const KEY_FILE_PATTERNS: RegExp[] = [
  /^package\.json$/,
  /^readme(\.md|\.mdx)?$/i,
  /^requirements\.txt$/,
  /^pyproject\.toml$/,
  /^setup\.py$/,
  /^manage\.py$/,
  /^pom\.xml$/,
  /^build\.gradle(\.kts)?$/,
  /^go\.mod$/,
  /^cargo\.toml$/i,
  /^gemfile$/i,
  /^composer\.json$/,
  /^dockerfile$/i,
  /^docker-compose\.ya?ml$/,
  /^(src\/)?(main|app|index|server)\.(py|go|rs|rb|php|ts|js|java|kt)$/,
  /^(src\/)?main\/java\/.+Application\.java$/,
];

function buildAnalysisInput(files: ProjectFile[]): string {
  const manifest = files
    .slice(0, MANIFEST_PATHS)
    .map((f) => f.path)
    .join("\n");

  let budget = TOTAL_KEY_CHARS;
  const keyBlocks: string[] = [];
  for (const f of files) {
    if (budget <= 0) break;
    const name = f.path.toLowerCase();
    if (!KEY_FILE_PATTERNS.some((re) => re.test(name))) continue;
    const excerpt = f.content.slice(0, Math.min(KEY_FILE_CHARS, budget));
    budget -= excerpt.length;
    keyBlocks.push(`### ${f.path}\n\`\`\`\n${excerpt}\n\`\`\``);
  }

  return `## File manifest (${files.length} files)\n${manifest}\n\n## Key files\n${
    keyBlocks.join("\n\n") || "(none matched)"
  }`;
}

const ANALYSIS_SYSTEM = `You are Astra, Ren's repository analyst. You are given a repository's file manifest and key files. Decide what this project is and how the workspace should surface it.

Respond with ONLY a JSON object — no prose, no markdown fence — with exactly these fields:
{
  "kind": "frontend" | "static-site" | "fullstack" | "backend" | "library" | "unknown",
  "previewMode": "sandpack" | "static" | "console",
  "hasFrontend": boolean,        // does it contain a real user-facing web UI?
  "language": "primary language",
  "framework": "main framework, or the language name if none",
  "entryPoint": "path of the main entry file, or null",
  "runCommands": ["shell commands to install and run it locally, in order"],
  "summary": "2-3 sentences a developer would find genuinely useful: what the project does and how it's structured",
  "suggestFrontend": boolean     // true when it has no web UI and one would plausibly be useful (APIs, bots, CLIs); false for libraries/tooling where a UI makes no sense
}

Rules:
- "sandpack" is ONLY for client-side React apps (Vite/CRA style) that run fully in the browser. "static" is ONLY for plain HTML/CSS/JS sites. Everything else — Python, Java, Go, Rust, server-rendered frameworks like Next.js, Node APIs, libraries — is "console".
- If the repo contains BOTH a backend AND a client-side React app (e.g. a frontend/ directory), pick previewMode "sandpack" with hasFrontend true — the workspace previews the client app.
- runCommands must be real commands for THIS project (from its manifests/scripts), max 6.
- Be decisive. If genuinely unclear, use kind "unknown", previewMode "console".`;

export async function POST(req: NextRequest) {
  // Parse body defensively — a malformed request gets an empty profile, not a 500.
  let files: ProjectFile[] = [];
  try {
    const body = (await req.json()) as { files?: unknown };
    if (Array.isArray(body.files)) {
      files = body.files
        .filter(
          (f): f is ProjectFile =>
            !!f &&
            typeof (f as ProjectFile).path === "string" &&
            typeof (f as ProjectFile).content === "string",
        )
        .slice(0, MAX_FILES);
    }
  } catch {
    /* fall through with empty files */
  }

  const heuristic = heuristicRepoProfile(files);
  const respond = (profile: RepoPreviewProfile) => NextResponse.json({ profile });

  // Auth mirrors /api/builder: when Supabase is configured, a session is
  // required (the analysis spends our inference); local dev runs open.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ profile: heuristic }, { status: 401 });
  }

  if (!files.length || !isAstraConfigured()) return respond(heuristic);

  try {
    const result = await completeAstraText(
      [
        { role: "system", content: ANALYSIS_SYSTEM },
        { role: "user", content: buildAnalysisInput(files) },
      ],
      {
        maxTokens: 900,
        temperature: 0.2,
        reasoningEffort: "low",
        // Time-box: a slow provider degrades to heuristics, never hangs the UI.
        signal: AbortSignal.timeout(35_000),
      },
    );
    if (!result.ok) return respond(heuristic);

    // Extract the first JSON object from the response (models sometimes wrap
    // it in a fence or lead with a word despite instructions).
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return respond(heuristic);
    const raw = JSON.parse(match[0]) as AstraRepoVerdict;

    return respond(mergeAstraVerdict(heuristic, raw));
  } catch {
    return respond(heuristic);
  }
}
