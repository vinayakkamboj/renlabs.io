/**
 * Context pack — repository intelligence applied to a single request.
 *
 * Before each build the agent scores every project file for relevance to the
 * current user message, then packs the highest-scoring files into the prompt in
 * priority order. Files that would blow the budget are truncated at role-aware
 * line limits. This keeps the model grounded in the real current state of the
 * app instead of hallucinating imports and file contents.
 *
 * Scoring factors (mirrors the proven reference heuristics):
 *   - project memory (REN.md)        → +25  (always relevant)
 *   - root entry (src/App.tsx)       → +24  (always relevant)
 *   - file named in the error trace  → +40  (force-include the crash site)
 *   - recently changed file          → +16  (likely still in play)
 *   - token match with the request   →  +8  per distinct domain word
 */

import { classifyRole, type FileRole } from "@/lib/ai/repository-intelligence";
import { PROJECT_MEMORY_FILE } from "./base-template";
import type { ProjectFile } from "./types";

const TRUNCATE_LINES: Partial<Record<FileRole, number>> = {
  page: 200,
  component: 150,
  layout: 150,
  hook: 100,
  service: 100,
  store: 100,
  data: 60,
};
const DEFAULT_TRUNCATE = 120;

/** Roughly 4 chars per token — keep the pack well under the model budget. */
const MAX_PACK_CHARS = 48_000;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
  "add", "make", "build", "create", "update", "change", "fix", "want", "need",
  "should", "would", "could", "page", "app", "use", "using", "have", "has",
  "can", "new", "all", "any", "but", "not", "are", "was", "will", "let",
]);

function extractTokens(message: string): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return Array.from(new Set(words));
}

function fileNameTokens(path: string): string[] {
  return path
    .toLowerCase()
    .replace(/\.[a-z]+$/, "")
    .split(/[\/._-]/)
    .filter(Boolean);
}

interface ScoredFile {
  file: ProjectFile;
  role: FileRole;
  score: number;
}

export interface ContextPackOptions {
  /** Paths of files changed in the previous turn. */
  recentlyChanged?: string[];
  /** Paths surfaced by a runtime error trace. */
  errorPaths?: string[];
}

function scoreFiles(
  files: ProjectFile[],
  requestTokens: string[],
  opts: ContextPackOptions,
): ScoredFile[] {
  const recent = new Set(opts.recentlyChanged ?? []);
  const errored = new Set(opts.errorPaths ?? []);

  return files
    .map((file) => {
      const role = classifyRole(file.path);
      let score = 0;

      if (file.path === PROJECT_MEMORY_FILE) score += 25;
      if (file.path === "src/App.tsx") score += 24;
      if (errored.has(file.path)) score += 40;
      if (recent.has(file.path)) score += 16;

      const haystack = new Set([
        ...fileNameTokens(file.path),
        ...extractTokens(file.content.slice(0, 4000)),
      ]);
      for (const token of requestTokens) {
        if (haystack.has(token)) score += 8;
      }

      // Lightly favour source over config so edits extend the real app.
      if (role === "config") score -= 4;

      return { file, role, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Compact export signature for the repo map ("default HomePage, useCart,
 * CartItem"). On big projects most files can't ship full content within the
 * budget — the signature line still tells the model exactly what each module
 * exports, so it imports instead of re-creating, and never re-declares an
 * identifier that already exists.
 */
function exportSignature(content: string): string | null {
  const names: string[] = [];
  const re =
    /^export\s+(default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null && names.length < 8) {
    names.push(m[1] ? `default ${m[2]}` : m[2]);
  }
  if (!names.length && /^export\s+default\b/m.test(content)) names.push("default");
  return names.length ? names.join(", ") : null;
}

function truncate(content: string, role: FileRole): string {
  const limit = TRUNCATE_LINES[role] ?? DEFAULT_TRUNCATE;
  const lines = content.split("\n");
  if (lines.length <= limit) return content;
  return (
    lines.slice(0, limit).join("\n") +
    `\n// … truncated ${lines.length - limit} more lines …`
  );
}

/**
 * Build the markdown context block describing the current project state.
 */
export function buildContextPack(
  files: ProjectFile[],
  userMessage: string,
  opts: ContextPackOptions = {},
): string {
  if (!files.length) {
    return "## Current project files\n\n(empty — this is the first build)";
  }

  const requestTokens = extractTokens(userMessage);
  const scored = scoreFiles(files, requestTokens, opts);

  const sections: string[] = [];
  let budget = MAX_PACK_CHARS;

  for (const { file, role } of scored) {
    if (budget <= 0) break;
    const body = truncate(file.content, role);
    const lang = file.path.split(".").pop() ?? "";
    const block = `### ${file.path}\n\`\`\`${lang}\n${body}\n\`\`\``;
    if (block.length > budget && sections.length > 0) continue;
    sections.push(block);
    budget -= block.length;
  }

  // Repo map: every path + what it exports. This is what keeps LARGE projects
  // coherent — files whose content didn't fit the budget are still fully
  // "known" (they exist, and these are their exports), so the model links to
  // them instead of re-creating them or re-declaring their identifiers.
  const tree = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => {
      const sig = /\.(tsx?|jsx?)$/.test(f.path) ? exportSignature(f.content) : null;
      return sig ? `- ${f.path} — exports: ${sig}` : `- ${f.path}`;
    })
    .join("\n");

  return [
    "## Current project file tree (repo map)",
    tree,
    "",
    "EVERY file above already exists. Import from it with a relative path — never re-create an existing file unless you are intentionally replacing it, never invent a file that isn't listed without also creating it in this patch, and never declare an identifier that an existing file already exports into the same file twice.",
    "",
    "## Current project files (most relevant first)",
    sections.join("\n\n"),
  ].join("\n");
}
