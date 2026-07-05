/**
 * Repository preview intelligence — decides HOW an attached repository is
 * surfaced in the workspace.
 *
 * Architecture (layered so a failure at any layer degrades, never errors):
 *
 *   Layer 1 — heuristics (this file, pure, instant, client-safe)
 *     Reads manifests, extensions, and entrypoints. Always produces a
 *     complete profile. This is the floor: the UI can render from it alone.
 *
 *   Layer 2 — Astra (POST /api/builder/analyze-repo, model call)
 *     The LLM reads the file manifest + key files and returns a structured
 *     verdict: what the repo IS, whether it has a frontend, how to run it,
 *     and a human summary. Its output is validated by `mergeAstraVerdict`
 *     below before anything trusts it.
 *
 *   Safety rule — Astra decides MEANING, heuristics decide CAPABILITY:
 *     the model may downgrade a preview (say "this React folder is just docs
 *     tooling, show the console"), but it can never force the sandbox to run
 *     something the bundler provably can't (no upgrade console → sandpack).
 *     A hallucinated verdict therefore can't produce a broken preview.
 */

import type { ProjectFile } from "./types";
import { analyzeWebApp } from "./web-app";

export type RepoKind =
  | "frontend"
  | "static-site"
  | "fullstack"
  | "backend"
  | "library"
  | "unknown";

/** How the workspace surfaces the repo. */
export type PreviewMode =
  | "sandpack" // client-side React app — run it live
  | "static" // plain HTML/CSS/JS — serve it
  | "console"; // backend / library / non-web — code console instead of preview

export interface RepoPreviewProfile {
  kind: RepoKind;
  previewMode: PreviewMode;
  /** Does the repo contain a real user-facing frontend? Drives the
   *  "want Astra to add a frontend?" suggestion when false. */
  hasFrontend: boolean;
  language: string;
  framework: string;
  entryPoint: string | null;
  /** Commands to build/run the project locally, in order. */
  runCommands: string[];
  /** One-paragraph human explanation of what this repository is. */
  summary: string;
  suggestFrontend: boolean;
  source: "heuristic" | "astra";
}

// ─── Language detection ──────────────────────────────────────────────────────

const LANGUAGE_EXT: Record<string, string> = {
  py: "Python",
  java: "Java",
  kt: "Kotlin",
  go: "Go",
  rs: "Rust",
  rb: "Ruby",
  php: "PHP",
  cs: "C#",
  swift: "Swift",
  scala: "Scala",
  c: "C",
  cpp: "C++",
  cc: "C++",
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  vue: "Vue",
  svelte: "Svelte",
};

/** Most common source language by file count (config/doc files excluded). */
export function detectPrimaryLanguage(files: ProjectFile[]): string {
  const counts = new Map<string, number>();
  for (const f of files) {
    const ext = f.path.split(".").pop()?.toLowerCase() ?? "";
    const lang = LANGUAGE_EXT[ext];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let best = "Unknown";
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}

// ─── Run-command inference ───────────────────────────────────────────────────

interface BackendSignature {
  present: (paths: Set<string>, files: ProjectFile[]) => boolean;
  language: string;
  framework: string;
  entry: (paths: Set<string>) => string | null;
  commands: (paths: Set<string>) => string[];
}

const first = (paths: Set<string>, candidates: string[]): string | null =>
  candidates.find((c) => paths.has(c)) ?? null;

const BACKEND_SIGNATURES: BackendSignature[] = [
  {
    present: (p) => p.has("manage.py"),
    language: "Python",
    framework: "Django",
    entry: () => "manage.py",
    commands: () => [
      "pip install -r requirements.txt",
      "python manage.py migrate",
      "python manage.py runserver",
    ],
  },
  {
    present: (p, files) =>
      (p.has("requirements.txt") || p.has("pyproject.toml")) &&
      files.some((f) => /\.py$/.test(f.path) && /\bFastAPI\s*\(/.test(f.content)),
    language: "Python",
    framework: "FastAPI",
    entry: (p) => first(p, ["main.py", "app.py", "app/main.py", "src/main.py"]),
    commands: (p) => [
      p.has("requirements.txt") ? "pip install -r requirements.txt" : "pip install .",
      "uvicorn main:app --reload",
    ],
  },
  {
    present: (p, files) =>
      (p.has("requirements.txt") || p.has("pyproject.toml")) &&
      files.some((f) => /\.py$/.test(f.path) && /\bFlask\s*\(/.test(f.content)),
    language: "Python",
    framework: "Flask",
    entry: (p) => first(p, ["app.py", "main.py", "wsgi.py"]),
    commands: () => ["pip install -r requirements.txt", "flask run"],
  },
  {
    present: (p) => p.has("requirements.txt") || p.has("pyproject.toml") || p.has("setup.py"),
    language: "Python",
    framework: "Python",
    entry: (p) => first(p, ["main.py", "app.py", "run.py", "src/main.py", "__main__.py"]),
    commands: (p) => [
      p.has("requirements.txt") ? "pip install -r requirements.txt" : "pip install .",
      `python ${first(p, ["main.py", "app.py", "run.py", "src/main.py"]) ?? "main.py"}`,
    ],
  },
  {
    present: (p) => p.has("pom.xml"),
    language: "Java",
    framework: "Maven",
    entry: (p) => first(p, ["pom.xml"]),
    commands: () => ["mvn clean package", "mvn spring-boot:run"],
  },
  {
    present: (p) => p.has("build.gradle") || p.has("build.gradle.kts"),
    language: "Java",
    framework: "Gradle",
    entry: (p) => first(p, ["build.gradle", "build.gradle.kts"]),
    commands: () => ["./gradlew build", "./gradlew run"],
  },
  {
    present: (p) => p.has("go.mod"),
    language: "Go",
    framework: "Go",
    entry: (p) => first(p, ["main.go", "cmd/main.go"]),
    commands: () => ["go mod download", "go run ."],
  },
  {
    present: (p) => p.has("Cargo.toml") || p.has("cargo.toml"),
    language: "Rust",
    framework: "Cargo",
    entry: (p) => first(p, ["src/main.rs", "src/lib.rs"]),
    commands: () => ["cargo build", "cargo run"],
  },
  {
    present: (p) => p.has("Gemfile") || p.has("gemfile"),
    language: "Ruby",
    framework: "Ruby",
    entry: (p) => first(p, ["config.ru", "app.rb", "main.rb"]),
    commands: (p) =>
      p.has("bin/rails")
        ? ["bundle install", "bin/rails server"]
        : ["bundle install", "ruby app.rb"],
  },
  {
    present: (p) => p.has("composer.json"),
    language: "PHP",
    framework: "PHP",
    entry: (p) => first(p, ["index.php", "public/index.php", "artisan"]),
    commands: (p) =>
      p.has("artisan")
        ? ["composer install", "php artisan serve"]
        : ["composer install", "php -S localhost:8000"],
  },
];

// ─── Layer 1: heuristic profile ──────────────────────────────────────────────

/**
 * Deterministic profile — always succeeds, runs anywhere (client or server).
 * The UI can render entirely from this; Astra's verdict only refines it.
 */
export function heuristicRepoProfile(files: ProjectFile[]): RepoPreviewProfile {
  const web = analyzeWebApp(files);
  const paths = new Set(files.map((f) => f.path));
  const language = detectPrimaryLanguage(files);

  if (web.status === "previewable") {
    return {
      kind: "frontend",
      previewMode: "sandpack",
      hasFrontend: true,
      language,
      framework: web.framework,
      entryPoint: null,
      runCommands: ["npm install", "npm run dev"],
      summary: "A client-side React app — it runs live in the preview.",
      suggestFrontend: false,
      source: "heuristic",
    };
  }

  if (web.status === "static") {
    return {
      kind: "static-site",
      previewMode: "static",
      hasFrontend: true,
      language: language === "Unknown" ? "HTML" : language,
      framework: "Static site",
      entryPoint: web.entryHtml ?? "index.html",
      runCommands: ["Open index.html, or: npx serve ."],
      summary: "A static site — served directly in the preview.",
      suggestFrontend: false,
      source: "heuristic",
    };
  }

  // Backend signature match (Python / Java / Go / Rust / Ruby / PHP …)
  const sig = BACKEND_SIGNATURES.find((s) => s.present(paths, files));
  if (sig) {
    return {
      kind: "backend",
      previewMode: "console",
      hasFrontend: false,
      language: sig.language,
      framework: sig.framework,
      entryPoint: sig.entry(paths),
      runCommands: sig.commands(paths),
      summary: `A ${sig.framework} project. There's no browser-runnable frontend, so the workspace shows the code console instead of a live preview.`,
      suggestFrontend: true,
      source: "heuristic",
    };
  }

  if (web.status === "fullstack") {
    return {
      kind: "fullstack",
      previewMode: "console",
      hasFrontend: true, // it HAS a frontend — we just can't run it client-side
      language,
      framework: web.framework,
      entryPoint: null,
      runCommands: ["npm install", "npm run dev"],
      summary: `${web.framework} renders on a server, so it can't run in the browser preview yet. You can still read, explain, and edit everything with Astra.`,
      suggestFrontend: false,
      source: "heuristic",
    };
  }

  // Node backend / library / unknown
  const hasPkg = paths.has("package.json");
  return {
    kind: hasPkg ? "library" : "unknown",
    previewMode: "console",
    hasFrontend: false,
    language,
    framework: hasPkg ? "Node.js" : language,
    entryPoint: first(paths, ["src/index.ts", "index.ts", "src/index.js", "index.js"]),
    runCommands: hasPkg ? ["npm install", "npm start"] : [],
    summary:
      "No browser-runnable frontend was detected, so the workspace shows the code console. Astra can still read and edit every file.",
    suggestFrontend: true,
    source: "heuristic",
  };
}

// ─── Layer 2 validation: merge Astra's verdict safely ────────────────────────

const KINDS: RepoKind[] = [
  "frontend",
  "static-site",
  "fullstack",
  "backend",
  "library",
  "unknown",
];
const MODES: PreviewMode[] = ["sandpack", "static", "console"];

/** Raw JSON shape Astra is asked to produce. All fields untrusted. */
export interface AstraRepoVerdict {
  kind?: string;
  previewMode?: string;
  hasFrontend?: boolean;
  language?: string;
  framework?: string;
  entryPoint?: string | null;
  runCommands?: unknown;
  summary?: string;
  suggestFrontend?: boolean;
}

const clampText = (v: unknown, max: number, fallback: string): string =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;

/**
 * Merge Astra's verdict with the heuristic floor. Every field is validated;
 * the CAPABILITY rule is enforced here: previewMode may only move toward
 * "console" (downgrade), never away from it — the sandbox never runs
 * something the heuristics say it can't.
 */
export function mergeAstraVerdict(
  heuristic: RepoPreviewProfile,
  raw: AstraRepoVerdict,
): RepoPreviewProfile {
  const kind = KINDS.includes(raw.kind as RepoKind)
    ? (raw.kind as RepoKind)
    : heuristic.kind;

  let previewMode = MODES.includes(raw.previewMode as PreviewMode)
    ? (raw.previewMode as PreviewMode)
    : heuristic.previewMode;
  // Capability gate: no upgrades past what the bundler can actually do.
  if (heuristic.previewMode === "console") previewMode = "console";
  if (heuristic.previewMode === "static" && previewMode === "sandpack")
    previewMode = "static";

  const runCommands = Array.isArray(raw.runCommands)
    ? raw.runCommands
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim().slice(0, 120))
        .slice(0, 6)
    : heuristic.runCommands;

  return {
    kind,
    previewMode,
    hasFrontend:
      typeof raw.hasFrontend === "boolean" ? raw.hasFrontend : heuristic.hasFrontend,
    language: clampText(raw.language, 40, heuristic.language),
    framework: clampText(raw.framework, 60, heuristic.framework),
    entryPoint:
      typeof raw.entryPoint === "string" && raw.entryPoint.trim()
        ? raw.entryPoint.trim().slice(0, 200)
        : heuristic.entryPoint,
    runCommands: runCommands.length ? runCommands : heuristic.runCommands,
    summary: clampText(raw.summary, 600, heuristic.summary),
    suggestFrontend:
      typeof raw.suggestFrontend === "boolean"
        ? raw.suggestFrontend
        : heuristic.suggestFrontend,
    source: "astra",
  };
}

/** Stable content hash for caching a profile per file-set (djb2 over paths+sizes). */
export function repoContentHash(files: ProjectFile[]): string {
  let h = 5381;
  for (const f of files) {
    const s = `${f.path}:${f.content.length}`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
