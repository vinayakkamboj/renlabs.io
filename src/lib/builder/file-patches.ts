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

import type { FilePatch, FileEdit, FilePatchPlan, FatalIssue, ProjectFile } from "./types";
import { PROTECTED_PATHS } from "./base-template";

// ─── Parsing ───────────────────────────────────────────────────────────────

export function parseFilePatchPlan(content: string): FilePatchPlan | null {
  const strictMatch = content.match(/<file_patches>([\s\S]*?)<\/file_patches>/);
  const looseMatch = content.match(/<file_patches>([\s\S]*)/);
  const match = strictMatch ?? looseMatch;
  if (!match) return null;

  // Models (GLM especially) often wrap the JSON in a markdown code fence
  // despite instructions. Unwrap it BEFORE the strict parse — otherwise the
  // fence forces the lossy scan recovery, which silently drops edits/deletes/
  // renames and the plan summary.
  const raw = match[1]
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  // Strategy 1 — direct parse (happy path: the block is complete and valid).
  // Accept any plan that carries work — full-file changes OR surgical edits.
  try {
    const result = JSON.parse(raw) as FilePatchPlan;
    if (result?.changes?.length || result?.edits?.length) return normalize(result);
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
    edits: Array.isArray(plan.edits)
      ? plan.edits.filter(
          (e): e is FileEdit =>
            !!e &&
            typeof e.path === "string" &&
            typeof e.find === "string" &&
            typeof e.replace === "string" &&
            e.find.length > 0,
        )
      : undefined,
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

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count++;
    from = idx + needle.length;
  }
  return count;
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
  let inRegex = false; // inside a /regex literal/
  let inRegexClass = false; // inside [...] within a regex (a / here doesn't end it)
  // Last significant (non-whitespace, non-comment, non-string) char seen — used
  // to distinguish a regex literal from the division operator.
  let prevSig = "";

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
    if (inRegex) {
      // Quotes and brackets inside a regex literal are plain characters —
      // without this, `s.replace(/["']/g, "")` reads as an unterminated string
      // and a perfectly complete file gets flagged as truncated.
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "[") inRegexClass = true;
      else if (ch === "]") inRegexClass = false;
      else if (ch === "/" && !inRegexClass) {
        inRegex = false;
        prevSig = "/"; // regex value ended — a following / would be division
      } else if (ch === "\n") {
        // Regex literals can't span lines — this wasn't a regex after all.
        // Bail out conservatively (the check must never wrongly reject).
        inRegex = false;
        inRegexClass = false;
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
    if (ch === "/") {
      // Regex literal vs division: after an identifier/number/closing bracket
      // it's division, and after } > < it's JSX (self-close `/>`, closing tag
      // `</`) — only an operator/opening-bracket position starts a regex
      // (after ( [ { , ; = : ! & | ? etc. or at file start).
      const divisionBefore = /[\w$)\]}><]/.test(prevSig);
      if (!divisionBefore) {
        inRegex = true;
        inRegexClass = false;
        continue;
      }
      prevSig = ch;
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
    if (!/\s/.test(ch)) prevSig = ch;
  }

  // Complete only if we didn't end mid-string, mid-comment, or with open brackets.
  return inString === null && !inBlockComment && stack.length === 0;
}

/** Remove the <file_patches> block (closed or truncated) from chat content. */
export function stripFilePatchPlan(content: string): string {
  let stripped = content;
  // Remove chain-of-thought the model may emit despite instructions — both a
  // fully-closed block and a trailing unclosed one (mid-stream). Without this,
  // the entire reasoning dump streams into the chat panel and looks broken.
  stripped = stripped.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  stripped = stripped.replace(/<thinking>[\s\S]*$/i, "");
  // GLM-family models use <think> (not <thinking>) when reasoning leaks into
  // the content stream — strip both closed and trailing-unclosed variants.
  stripped = stripped.replace(/<think>[\s\S]*?<\/think>/gi, "");
  stripped = stripped.replace(/<think>[\s\S]*$/i, "");
  // Remove the file_patches block (closed, or trailing/unclosed while streaming).
  stripped = stripped.replace(/<file_patches>[\s\S]*?<\/file_patches>/, "");
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

  const edits = plan.edits ?? [];
  if (!plan.changes.length && !edits.length) {
    issues.push({ type: "no-changes", detail: "No file changes were produced." });
    return issues;
  }

  // First builds must have full-file changes (not just edits). Edits silently
  // fail when the find text doesn't match the seeded template exactly.
  if (isFirstBuild && plan.changes.length < 3) {
    issues.push({
      type: "no-changes",
      detail: `First build produced only ${plan.changes.length} full file(s) — expected at least 3 complete \`changes\` entries (App.tsx, index.css, and at least one page). Do not use \`edits\` on first builds; rewrite every file via \`changes\`.`,
    });
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

  // Duplicate top-level declarations — "Identifier 'X' has already been
  // declared" is a hard SyntaxError that takes down the entire preview, so a
  // file that declares the same name twice must never be applied.
  for (const change of plan.changes) {
    if (!isCodePath(change.path)) continue;
    for (const name of findDuplicateTopLevelDecls(change.content)) {
      issues.push({
        type: "duplicate-identifier",
        detail: `${change.path} declares "${name}" more than once at the top level — rename or remove one declaration (a duplicate identifier is a SyntaxError that crashes the whole app).`,
      });
    }
  }

  // Edit validation. Each edit's `find` must resolve against the file's current
  // content (a same-turn full change wins over the existing file) and must match
  // EXACTLY ONCE. A miss or an ambiguous match would corrupt the file, so we
  // reject the candidate and let the build loop repair it.
  const changeByPath = new Map(plan.changes.map((c) => [c.path, c.content]));
  const existingByPath = new Map(existing.map((f) => [f.path, f.content]));
  for (const edit of edits) {
    if (!isSafePath(edit.path)) {
      issues.push({ type: "invalid-path", detail: `Unsafe edit path: ${edit.path}` });
      continue;
    }
    const current = changeByPath.get(edit.path) ?? existingByPath.get(edit.path);
    if (current === undefined) {
      issues.push({
        type: "edit-failed",
        detail: `Edit targets "${edit.path}", which doesn't exist. Create it via "changes" instead.`,
      });
      continue;
    }
    const matches = countOccurrences(current, edit.find);
    if (matches === 0) {
      issues.push({
        type: "edit-failed",
        detail: `Edit for "${edit.path}" — its "find" text wasn't found verbatim. Copy the exact current text, or rewrite the file via "changes".`,
      });
    } else if (matches > 1) {
      issues.push({
        type: "edit-failed",
        detail: `Edit for "${edit.path}" — its "find" text matches ${matches} places; make it unique with more surrounding lines.`,
      });
    }
  }

  // Relative imports must resolve to a file that will exist after applying.
  const resultPaths = new Set(existing.map((f) => f.path));
  for (const c of plan.changes) resultPaths.add(c.path);
  for (const e of edits) resultPaths.add(e.path);
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

/**
 * Find identifiers declared more than once at module top level. Column-0
 * anchored so nested (indented) declarations don't count, and limited to
 * declaration kinds that actually collide — `interface`/`type` merge legally
 * in TS and are deliberately excluded. Catches the classic preview-killer:
 * `export const X = …` plus `export default function X() {}` in one file.
 */
export function findDuplicateTopLevelDecls(content: string): string[] {
  const kinds = new Map<string, string[]>();
  const re =
    /^export\s+(?:default\s+)?(?:async\s+)?(function\*?|class|const|let|var|enum)\s+([A-Za-z_$][\w$]*)|^(?:async\s+)?(function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const kind = (m[1] ?? m[3]).replace("*", "");
    const name = m[2] ?? m[4];
    if (!name) continue;
    const list = kinds.get(name) ?? [];
    list.push(kind);
    kinds.set(name, list);
  }
  const dupes: string[] = [];
  for (const [name, list] of kinds) {
    if (list.length < 2) continue;
    // function+function repeats can be legal TS overloads — everything else
    // (const+function, const+const, class+class, …) is always a SyntaxError.
    const allFunctions = list.every((k) => k === "function");
    if (!allFunctions) dupes.push(name);
  }
  return dupes;
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

  // Surgical edits run after full-file changes so they can target same-turn
  // content. Each edit is applied only if its `find` matches EXACTLY ONCE — a
  // miss or ambiguous match is skipped rather than risk corrupting the file
  // (validation already flags these, so a clean candidate applies fully here).
  for (const edit of plan.edits ?? []) {
    if (PROTECTED_PATHS.includes(edit.path)) continue;
    if (!isSafePath(edit.path)) continue;
    const current = map.get(edit.path);
    if (current === undefined) continue;
    if (countOccurrences(current, edit.find) !== 1) continue;
    map.set(edit.path, current.replace(edit.find, edit.replace));
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

// ─── Dangling-import safety net ─────────────────────────────────────────────

/** Turn "HomePage" / "use-cart" into a valid PascalCase component name. */
function componentNameFromPath(path: string): string {
  const base = path.split("/").pop()?.replace(/\.(tsx|ts|jsx|js)$/, "") ?? "Stub";
  const name = base
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
  return /^[A-Za-z_$]/.test(name) ? name : `Stub${name}`;
}

/** Resolve "./pages/HomePage" from "src/App.tsx" → "src/pages/HomePage". */
function resolveRelative(importerPath: string, spec: string): string {
  const parts = importerPath.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    else if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

/**
 * Guarantee the file set is RUNNABLE: for every relative import that doesn't
 * resolve to an existing file, generate a minimal placeholder module so the
 * preview renders instead of crashing with "Could not find module".
 *
 * This is the safety net for interrupted builds — a partial pass that shipped
 * src/App.tsx importing pages that were never generated (stream cut off, user
 * pressed Stop mid-continuation, refresh mid-build) must never brick the app.
 * Stubs are visibly "still being built" so the user knows to continue.
 */
export function stubDanglingImports(files: ProjectFile[]): {
  files: ProjectFile[];
  stubbed: string[];
} {
  const have = new Set(files.map((f) => f.path));
  const out = [...files];
  const stubbed: string[] = [];

  const exists = (p: string) =>
    have.has(p) ||
    ["tsx", "ts", "jsx", "js", "css", "json"].some((ext) => have.has(`${p}.${ext}`)) ||
    ["tsx", "ts"].some((ext) => have.has(`${p}/index.${ext}`));

  const importRe =
    /import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:from\s*)?["'](\.\.?\/[^"']+)["']/g;

  // Pass 1 — aggregate demand per missing module across ALL importers, so a
  // module imported as default by one file and by name from another gets ONE
  // stub that satisfies every consumer.
  const demands = new Map<string, Set<string>>();
  for (const file of files) {
    if (!isCodePath(file.path)) continue;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(file.content)) !== null) {
      const [, , namedGroup, spec] = m;
      const target = resolveRelative(file.path, spec);
      if (exists(target)) continue;

      if (/\.css$/.test(target)) {
        if (!have.has(target)) {
          out.push({ path: target, content: "/* pending — being built */\n" });
          have.add(target);
          stubbed.push(target);
        }
        continue;
      }

      const path = /\.(tsx|ts|jsx|js)$/.test(target) ? target : `${target}.tsx`;
      if (have.has(path)) continue;

      const named = demands.get(path) ?? new Set<string>();
      for (const raw of (namedGroup ?? "").split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) named.add(name);
      }
      demands.set(path, named);
    }
  }

  // Pass 2 — emit one stub per missing module. The default function's
  // identifier must NOT collide with any named export ("Identifier 'X' has
  // already been declared" crashes the whole preview), so it is renamed until
  // unique — the default binding works regardless of the function's name.
  for (const [path, named] of demands) {
    const display = componentNameFromPath(path);
    let fnName = display;
    while (named.has(fnName)) fnName += "Stub";

    const lines: string[] = [
      `// Auto-stub: this module was referenced but not yet generated.`,
      `// Ask Ren to "continue the build" to replace it with the real thing.`,
    ];
    for (const n of named) {
      lines.push(`export const ${n}: any = () => null;`);
    }
    lines.push(
      `export default function ${fnName}() {`,
      `  return (`,
      `    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, fontFamily: "system-ui", color: "#666" }}>`,
      `      <strong style={{ fontSize: 18, color: "#333" }}>${display} is still being built</strong>`,
      `      <span style={{ fontSize: 14 }}>The build was interrupted — ask Ren to continue and finish this page.</span>`,
      `    </div>`,
      `  );`,
      `}`,
    );

    out.push({ path, content: lines.join("\n") + "\n" });
    have.add(path);
    stubbed.push(path);
  }

  return { files: out, stubbed };
}

// ─── Import-path normalization ───────────────────────────────────────────────

/** Top-level src/ directories we recognize even before any file exists in
 *  them — a bare import into one of these is always a project import, never
 *  an npm package. */
const KNOWN_SRC_DIRS = new Set([
  "components", "pages", "stores", "lib", "data", "hooks", "utils",
  "features", "context", "types", "constants", "layouts", "services", "game",
]);

/**
 * Rewrite src-rooted "bare" project imports (e.g. `from "stores/useHabitStore"`)
 * into proper relative paths (`from "../stores/useHabitStore"`).
 *
 * Models frequently assume a baseUrl/path-alias resolver; the preview bundler
 * has none, so these imports crash the app with "Could not find module".
 * Only specifiers whose first segment is a real (or well-known) top-level
 * directory under src/ are rewritten — bare npm package imports (react,
 * zustand, date-fns, …) are untouched. Runs deterministically on every apply,
 * so it also heals previously-saved projects on their next build pass.
 */
export function normalizeProjectImports(files: ProjectFile[]): {
  files: ProjectFile[];
  fixed: string[];
} {
  const srcDirs = new Set(KNOWN_SRC_DIRS);
  for (const f of files) {
    const m = /^src\/([^/]+)\//.exec(f.path);
    if (m) srcDirs.add(m[1]);
  }

  const fixed: string[] = [];
  // Covers: import x from "spec" · import "spec" · export { x } from "spec"
  // · dynamic import("spec")
  const specRe = /(from\s*|import\s*\(?\s*)(["'])([^"'\n]+)\2/g;

  const out = files.map((file) => {
    if (!isCodePath(file.path) || !file.path.startsWith("src/")) return file;
    let changed = false;
    const content = file.content.replace(specRe, (whole, kw, quote, spec) => {
      if (spec.startsWith(".") || spec.startsWith("/")) return whole;
      const first = spec.split("/")[0];
      if (!srcDirs.has(first)) return whole; // npm package — leave untouched
      // Relative path from the importer's directory to src/<spec>.
      const fromDir = file.path.split("/").slice(0, -1);
      const target = `src/${spec}`.split("/");
      let i = 0;
      while (i < fromDir.length && i < target.length - 1 && fromDir[i] === target[i]) i++;
      const ups = fromDir.length - i;
      const rel = (ups ? "../".repeat(ups) : "./") + target.slice(i).join("/");
      changed = true;
      return `${kw}${quote}${rel}${quote}`;
    });
    if (!changed) return file;
    fixed.push(file.path);
    return { ...file, content };
  });

  return { files: out, fixed };
}
