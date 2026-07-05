/**
 * Design lint — catches the "situational" design bugs the model ships even
 * when the code compiles: emoji in production UI, hardcoded hex colors that
 * bypass the token system, BrowserRouter (breaks preview navigation), raw
 * anchors instead of router Links, hand-written SVG path data (the #1 cause
 * of truncated files), a first build that never replaced the placeholder
 * font, and a missing dark theme.
 *
 * Two layers:
 *   1. `hardenGeneratedFiles` — deterministic auto-fixes applied on every
 *      build pass. Zero model calls, can never make a file worse.
 *   2. `detectDesignIssues` — checks that need the model to fix. They feed
 *      one bounded design-repair pass in the build loop (never an infinite
 *      retry), so a clean-compiling-but-broken-looking build gets one shot
 *      at fixing itself before shipping.
 */

import type { FilePatchPlan, ProjectFile } from "./types";
import { isCodePath } from "./file-patches";

export interface DesignIssue {
  path: string;
  detail: string;
}

// ─── Layer 1: deterministic hardening ────────────────────────────────────────

/**
 * Auto-fix generated files in place — the classes of bug where the correct
 * rewrite is unambiguous, so re-prompting the model would be waste:
 *
 *   - BrowserRouter → HashRouter (BrowserRouter silently breaks navigation
 *     inside the sandboxed preview iframe; HashRouter is the documented rule).
 *   - `<a href="/x">` internal anchors → keep the anchor but log it (rewriting
 *     JSX structurally is not safe textually; the lint reports it instead).
 *
 * Pure — returns new file objects, never mutates the input.
 */
export function hardenGeneratedFiles(files: ProjectFile[]): {
  files: ProjectFile[];
  fixed: string[];
} {
  const fixed: string[] = [];
  const out = files.map((file) => {
    if (!isCodePath(file.path)) return file;
    if (!/BrowserRouter/.test(file.content)) return file;
    const content = file.content
      // import { BrowserRouter as Router } / { BrowserRouter } from react-router-dom
      .replace(/\bBrowserRouter\b/g, "HashRouter")
      // A file may now import HashRouter twice (it already imported it plus the
      // rename above) — dedupe within a single import specifier list.
      .replace(/\{([^}]*)\}(\s*from\s*["']react-router-dom["'])/g, (_m, specs: string, tail: string) => {
        const seen = new Set<string>();
        const deduped = specs
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => {
            if (!s) return false;
            const key = s.replace(/\s+as\s+.*/, "").trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .join(", ");
        return `{ ${deduped} }${tail}`;
      });
    fixed.push(file.path);
    return { ...file, content };
  });
  return { files: out, fixed };
}

// ─── Layer 2: issues that need a model repair pass ──────────────────────────

// Emoji ranges that read as "AI slop" in production UI. Deliberately excludes
// arrows/symbols that have legitimate typographic use.
const EMOJI_RE =
  /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2728}\u{2764}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}]/u;

// A hex color literal in JSX/TS source. Tokens live in index.css only.
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/;

// Hand-written SVG path data — long `d="M…"` strings bloat responses and are
// the leading cause of mid-file truncation. lucide-react is the rule.
const SVG_PATH_RE = /<path\s[^>]*d\s*=\s*["'][^"']{40,}/;

const INTERNAL_ANCHOR_RE = /<a\s[^>]*href\s*=\s*["']\/(?!\/)/;

/**
 * Lint the files a patch produced (only the changed ones — pre-existing debt
 * is not this pass's job). `isFirstBuild` enables the whole-app checks (font,
 * dark theme) that only make sense when the model owned index.css this turn.
 */
export function detectDesignIssues(
  plan: FilePatchPlan,
  isFirstBuild: boolean,
): DesignIssue[] {
  const issues: DesignIssue[] = [];

  for (const change of plan.changes) {
    const { path, content } = change;

    if (path === "src/index.css") {
      if (isFirstBuild) {
        if (!/@import\s+url\(["']?https:\/\/fonts\.googleapis\.com/.test(content)) {
          issues.push({
            path,
            detail:
              "index.css has no Google Font @import — the placeholder system-ui font shipped as final. Pick a font from the design guide, @import it at the top of index.css, and set it on body.",
          });
        } else if (/family=(Inter|Plus\+Jakarta\+Sans)\b/.test(content)) {
          issues.push({
            path,
            detail:
              "index.css imports Inter / Plus Jakarta Sans — these are forbidden template fonts. Replace with a font that fits the product's personality.",
          });
        }
        if (!/\[data-theme=["']?dark["']?\]/.test(content)) {
          issues.push({
            path,
            detail:
              'index.css has no [data-theme="dark"] block — add a real dark theme with adjusted hues.',
          });
        }
      }
      continue;
    }

    if (!/\.(tsx|jsx)$/.test(path)) continue;

    if (EMOJI_RE.test(content)) {
      issues.push({
        path,
        detail: `${path} contains emoji in the UI — remove them and use lucide-react icons instead.`,
      });
    }
    if (HEX_COLOR_RE.test(content)) {
      issues.push({
        path,
        detail: `${path} hardcodes hex colors — move colors into the HSL tokens in src/index.css and use semantic classes (bg-primary, text-foreground, border-border…).`,
      });
    }
    if (SVG_PATH_RE.test(content)) {
      issues.push({
        path,
        detail: `${path} hand-writes inline <svg> path data — replace with a lucide-react icon (inline path strings are the main cause of truncated builds).`,
      });
    }
    if (INTERNAL_ANCHOR_RE.test(content)) {
      issues.push({
        path,
        detail: `${path} uses <a href="/..."> for internal navigation — use Link / NavLink from react-router-dom so routing works inside the preview.`,
      });
    }
    if (/window\.location\.(href|assign|replace)\s*[=(]/.test(content)) {
      issues.push({
        path,
        detail: `${path} navigates via window.location — use useNavigate() from react-router-dom instead.`,
      });
    }
  }

  return issues;
}

/** Human-readable block for the repair prompt. */
export function describeDesignIssues(issues: DesignIssue[]): string {
  return issues
    .map((i, idx) => `${idx + 1}. [design] ${i.detail}`)
    .join("\n");
}
