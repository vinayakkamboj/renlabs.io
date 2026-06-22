/**
 * File-patch protocol — the contract between the builder agent and the project.
 *
 * The agent emits a `<file_patches>` JSON block:
 *
 *   <file_patches>
 *   {
 *     "plan": "one sentence summary",
 *     "changes": [{ "path": "src/App.tsx", "content": "FULL FILE CONTENT" }],
 *     "deletes": ["src/old.tsx"],
 *     "renames": [{ "from": "src/A.tsx", "to": "src/B.tsx" }]
 *   }
 *   </file_patches>
 *
 * LLM output is frequently truncated mid-stream, so `parseFilePatchPlan` uses a
 * cascade of recovery strategies to extract whatever complete file patches it
 * can. Patches are validated by `detectFatalIssues` and applied atomically by
 * `applyPatchPlan` — the whole candidate is checked before any file is written.
 */

import type { FilePatch, FilePatchPlan, FatalIssue, ProjectFile } from "./types";
import { PROTECTED_PATHS } from "./base-template";

// ─── Parsing ───────────────────────────────────────────────────────────────

export function parseFilePatchPlan(content: string): FilePatchPlan | null {
  const strictMatch = content.match(/<file_patches>([\s\S]*?)<\/file_patches>/);
  const looseMatch = content.match(/<file_patches>([\s\S]*)/);
  const match = strictMatch ?? looseMatch;
  if (!match) return null;

  const raw = match[1].trim();

  // Strategy 1 — direct parse (happy path: the block is complete and valid).
  try {
    const result = JSON.parse(raw) as FilePatchPlan;
    if (result?.changes?.length) return normalize(result);
  } catch {
    /* fall through to recovery */
  }

  // Strategy 2 — character-scan for every FULLY-CLOSED {"path","content"} pair.
  //
  // This is the *safe* recovery for a truncated stream. It keeps only files
  // whose content string was completely written, and DROPS any file that was
  // cut off mid-content. We deliberately never "close" a truncated string with
  // a synthetic suffix: doing so fabricates a file that ends mid-token (e.g. an
  // unterminated SVG path), which then crashes the preview. Better to drop the
  // incomplete file — the missing-import / truncation checks will flag it and
  // the build loop will repair it.
  const scanned = extractCompletePatchesFromPartial(raw);
  if (scanned.length) {
    return { plan: extractPlanField(raw) ?? "Recovered from partial response", changes: scanned };
  }

  // Strategy 3 — XML-ish <file path="...">...</file> fallback.
  const tagged = extractTaggedFiles(raw);
  if (tagged.length) {
    return { plan: "Recovered from tagged response", changes: tagged };
  }

  // Strategy 4 — markdown ### path \n ```...``` sections.
  const markdown = extractMarkdownFileSections(raw);
  if (markdown.length) {
    return { plan: "Recovered from markdown response", changes: markdown };
  }

  return null;
}

/** Best-effort pull of the "plan" summary string from a (possibly truncated) block. */
function extractPlanField(raw: string): string | null {
  const m = raw.match(/"plan"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1];
  }
}

function normalize(plan: FilePatchPlan): FilePatchPlan {
  return {
    plan: plan.plan || "Applied changes",
    changes: (plan.changes ?? []).filter(
      (c): c is FilePatch =>
        !!c && typeof c.path === "string" && typeof c.content === "string",
    ),
    deletes: Array.isArray(plan.deletes)
      ? plan.deletes.filter((d) => typeof d === "string")
      : undefined,
    renames: Array.isArray(plan.renames)
      ? plan.renames.filter(
          (r) => r && typeof r.from === "string" && typeof r.to === "string",
        )
      : undefined,
  };
}

function extractTaggedFiles(raw: string): FilePatch[] {
  const changes: FilePatch[] = [];
  const fileRe = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;
  while ((match = fileRe.exec(raw)) !== null) {
    const path = match[1].trim();
    if (!isSafePath(path)) continue;
    changes.push({
      path,
      content: match[2].replace(/^\n/, "").replace(/\n\s*$/, ""),
    });
  }
  return changes;
}

function extractMarkdownFileSections(raw: string): FilePatch[] {
  const changes: FilePatch[] = [];
  const sectionRe = /^###\s+([^\n]+)\n```[a-zA-Z0-9_-]*\n([\s\S]*?)```/gm;
  let match: RegExpExecArray | null;
  while ((match = sectionRe.exec(raw)) !== null) {
    const path = match[1].trim().replace(/^`|`$/g, "");
    if (!isSafePath(path)) continue;
    changes.push({ path, content: match[2].replace(/\n\s*$/, "") });
  }
  return changes;
}

/**
 * Walk the raw string and extract every {"path":"...","content":"..."} pair
 * whose content string was fully closed (i.e. not truncated mid-stream).
 */
function extractCompletePatchesFromPartial(raw: string): FilePatch[] {
  const changes: FilePatch[] = [];
  const pathRe = /"path"\s*:\s*"([^"\\]*)"\s*,\s*"content"\s*:\s*"/g;

  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(raw)) !== null) {
    const path = m[1];
    let i = m.index + m[0].length;
    let fileContent = "";
    let complete = false;

    while (i < raw.length) {
      const ch = raw[i];
      if (ch === "\\") {
        const next = raw[i + 1] ?? "";
        switch (next) {
          case "n": fileContent += "\n"; break;
          case "t": fileContent += "\t"; break;
          case "r": fileContent += "\r"; break;
          case '"': fileContent += '"'; break;
          case "\\": fileContent += "\\"; break;
          case "/": fileContent += "/"; break;
          default: fileContent += next;
        }
        i += 2;
      } else if (ch === '"') {
        complete = true;
        i++;
        break;
      } else {
        fileContent += ch;
        i++;
      }
    }

    if (complete && isSafePath(path) && fileContent.trim()) {
      changes.push({ path, content: fileContent });
    }
  }

  // Deduplicate — keep last occurrence of each path
  const seen = new Set<string>();
  return [...changes]
    .reverse()
    .filter((c) => {
      if (seen.has(c.path)) return false;
      seen.add(c.path);
      return true;
    })
    .reverse();
}

function isSafePath(path: string): boolean {
  return Boolean(path) && !path.startsWith("/") && !path.includes("..");
}

/** True if `path` is a JS/TS source file we can syntax-sanity-check. */
export function isCodePath(path: string): boolean {
  return /\.(tsx?|jsx?|mjs|cjs)$/.test(path);
}

/**
 * Heuristic completeness check for a JS/TS/JSX/TSX file. Catches the common
 * truncation failure modes — a file cut off mid-stream — without a full parser:
 *
 *   - an unterminated string / template literal at EOF
 *   - an unterminated block comment at EOF
 *   - unbalanced (), [], {} brackets (more opens than closes, or mismatched)
 *
 * It walks the source, skipping over string and comment regions so that
 * brackets *inside* strings/comments don't count. This is intentionally
 * conservative: anything it can't be sure about, it treats as complete, so a
 * valid file is never wrongly rejected.
 */
export function isCodeFileComplete(content: string): boolean {
  const src = content;
  const stack: string[] = [];
  const closeToOpen: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  let inString: string | null = null; // active quote char: ' " `
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1] ?? "";

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++; // skip the escaped character
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }

    // Not currently inside a string or comment.
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push(ch);
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== closeToOpen[ch]) return false; // mismatched close
    }
  }

  // Complete only if we didn't end mid-string, mid-comment, or with open brackets.
  return inString === null && !inBlockComment && stack.length === 0;
}

/** Remove the <file_patches> block (closed or truncated) from chat content. */
export function stripFilePatchPlan(content: string): string {
  let stripped = content.replace(/<file_patches>[\s\S]*?<\/file_patches>/, "");
  stripped = stripped.replace(/<file_patches>[\s\S]*$/, "");
  return stripped.trim();
}

// ─── Validation ──────────────────────────────────────────────────────────────

const KEY_FILES = ["src/App.tsx", "src/main.tsx"];

/**
 * Detect issues that should block a candidate from being applied. `isFirstBuild`
 * relaxes the "App.tsx must be present" rule for incremental edits.
 */
export function detectFatalIssues(
  plan: FilePatchPlan,
  existing: ProjectFile[],
  isFirstBuild: boolean,
): FatalIssue[] {
  const issues: FatalIssue[] = [];

  if (!plan.changes.length) {
    issues.push({ type: "no-changes", detail: "No file changes were produced." });
    return issues;
  }

  for (const change of plan.changes) {
    if (!isSafePath(change.path)) {
      issues.push({
        type: "invalid-path",
        detail: `Unsafe or absolute path: ${change.path}`,
      });
    }
  }

  // App.tsx must exist after the build (either seeded already or in the patch).
  const hasAppTsx =
    plan.changes.some((c) => c.path === "src/App.tsx") ||
    existing.some((f) => f.path === "src/App.tsx");
  if (isFirstBuild && !hasAppTsx) {
    issues.push({
      type: "missing-app-tsx",
      detail: "First build did not produce src/App.tsx.",
    });
  }

  // Truncation detection. Two signals:
  //  1. A key file that's suspiciously short — likely a stub or cut-off.
  //  2. Any code file whose brackets/strings don't balance — cut off mid-file.
  for (const change of plan.changes) {
    if (KEY_FILES.includes(change.path) && change.content.trim().length < 120) {
      issues.push({
        type: "truncated",
        detail: `${change.path} is suspiciously short — likely truncated.`,
      });
      continue;
    }
    if (isCodePath(change.path) && !isCodeFileComplete(change.content)) {
      issues.push({
        type: "truncated",
        detail: `${change.path} has unbalanced brackets or an unterminated string — it was likely cut off mid-file.`,
      });
    }
  }

  // Relative imports must resolve to a file that will exist after applying.
  const resultPaths = new Set(existing.map((f) => f.path));
  for (const c of plan.changes) resultPaths.add(c.path);
  for (const d of plan.deletes ?? []) resultPaths.delete(d);

  for (const change of plan.changes) {
    if (!/\.(tsx?|jsx?)$/.test(change.path)) continue;
    for (const spec of extractRelativeImports(change.content)) {
      if (!resolvesToFile(change.path, spec, resultPaths)) {
        issues.push({
          type: "missing-file",
          detail: `${change.path} imports "${spec}" which has no matching file.`,
        });
      }
    }
  }

  return issues;
}

function extractRelativeImports(content: string): string[] {
  const specs: string[] = [];
  const importRe =
    /(?:import|export)[\s\S]*?from\s*["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    const spec = m[1] ?? m[2];
    if (spec) specs.push(spec);
  }
  return specs;
}

function resolvesToFile(
  fromPath: string,
  spec: string,
  paths: Set<string>,
): boolean {
  const dir = fromPath.split("/").slice(0, -1);
  const parts = spec.split("/");
  const stack = [...dir];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  const base = stack.join("/");
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
    `${base}.css`,
  ];
  return candidates.some((c) => paths.has(c));
}

// ─── Applying ──────────────────────────────────────────────────────────────

/**
 * Apply a patch plan to the current file set, returning a new array.
 * Pure — does not mutate the input. Protected paths are never overwritten.
 */
export function applyPatchPlan(
  files: ProjectFile[],
  plan: FilePatchPlan,
): ProjectFile[] {
  const map = new Map(files.map((f) => [f.path, f.content]));

  // Renames first, so subsequent changes can target the new path.
  for (const rename of plan.renames ?? []) {
    if (PROTECTED_PATHS.includes(rename.from)) continue;
    const content = map.get(rename.from);
    if (content !== undefined) {
      map.delete(rename.from);
      map.set(rename.to, content);
    }
  }

  for (const change of plan.changes) {
    if (PROTECTED_PATHS.includes(change.path)) continue;
    if (!isSafePath(change.path)) continue;
    map.set(change.path, change.content);
  }

  for (const del of plan.deletes ?? []) {
    if (PROTECTED_PATHS.includes(del)) continue;
    map.delete(del);
  }

  return Array.from(map, ([path, content]) => ({ path, content })).sort((a, b) =>
    a.path.localeCompare(b.path),
  );
}

/** Human-readable summary of fatal issues for a retry prompt. */
export function describeFatalIssues(issues: FatalIssue[]): string {
  return issues.map((i, idx) => `${idx + 1}. [${i.type}] ${i.detail}`).join("\n");
}
