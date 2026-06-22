/**
 * Decides how an imported project should be previewed.
 *
 * The preview runs in the browser (Sandpack). Two things can run with no server:
 *   • client-side React apps (Vite / CRA)  → bundled and rendered
 *   • plain static sites (HTML/CSS/JS)      → served as-is
 *
 * Server-rendered frameworks (Next.js, Remix, SvelteKit, …) and non-web
 * projects (backends, CLIs, other languages) can't run client-side yet — we
 * detect those and explain why, so nothing silently "fails to load".
 */

import type { ProjectFile } from "./types";

export type PreviewStatus = "previewable" | "static" | "fullstack" | "non-web";

export interface WebAppAnalysis {
  status: PreviewStatus;
  framework: string;
  detail: string;
  /** For static sites: the entry HTML file to serve. */
  entryHtml?: string;
}

const NON_WEB_MANIFESTS = [
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "go.mod",
  "cargo.toml",
  "pom.xml",
  "build.gradle",
  "gemfile",
  "composer.json",
  "pubspec.yaml",
  "package.swift",
];

/** Find the project's primary package.json (root preferred, else shallowest). */
function primaryPackageJson(files: ProjectFile[]): ProjectFile | undefined {
  const pkgs = files.filter(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json"),
  );
  if (!pkgs.length) return undefined;
  return pkgs.sort(
    (a, b) => a.path.split("/").length - b.path.split("/").length,
  )[0];
}

function readDeps(pkg: ProjectFile | undefined): string[] {
  if (!pkg) return [];
  try {
    const parsed = JSON.parse(pkg.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return [
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ];
  } catch {
    return [];
  }
}

/** React can be detected from deps OR from an actual `import … from "react"`. */
function importsReact(files: ProjectFile[]): boolean {
  return files.some(
    (f) =>
      /\.(jsx|tsx)$/.test(f.path) &&
      /\bfrom\s+['"]react['"]/.test(f.content),
  );
}

/** Pick the HTML file most likely to be the site entry. */
function findEntryHtml(files: ProjectFile[]): string | undefined {
  const htmls = files
    .filter((f) => f.path.toLowerCase().endsWith(".html"))
    .map((f) => f.path);
  if (!htmls.length) return undefined;
  // Prefer a root-level index.html, then any index.html, then the shallowest.
  return (
    htmls.find((p) => p === "index.html") ??
    htmls.find((p) => p.toLowerCase().endsWith("/index.html")) ??
    htmls.sort((a, b) => a.split("/").length - b.split("/").length)[0]
  );
}

export function analyzeWebApp(files: ProjectFile[]): WebAppAnalysis {
  const pkg = primaryPackageJson(files);
  const deps = readDeps(pkg);
  const has = (name: string) => deps.includes(name);
  const lowerPaths = files.map((f) => f.path.toLowerCase());
  const hasPackageJson = Boolean(pkg);
  const entryHtml = findEntryHtml(files);

  // Full-stack / server-rendered frameworks — need a server, can't run client-side.
  const fullstack: Array<[boolean, string]> = [
    [has("next"), "Next.js"],
    [has("nuxt") || has("nuxt3"), "Nuxt"],
    [has("@remix-run/react") || has("remix"), "Remix"],
    [has("@sveltejs/kit"), "SvelteKit"],
    [has("astro"), "Astro"],
    [has("@angular/core"), "Angular"],
    [has("@nestjs/core"), "NestJS"],
  ];
  const fs = fullstack.find(([yes]) => yes);

  // 1. Client-side React app (Vite / CRA) — bundle and render it.
  const isReactClient =
    !fs &&
    (has("react") || importsReact(files)) &&
    !has("next") &&
    !has("@remix-run/react");

  if (isReactClient) {
    return {
      status: "previewable",
      framework: "React",
      detail: "A client-side React app — running it live below.",
    };
  }

  // 2. Server-rendered framework — explain, don't fail.
  if (fs) {
    return {
      status: "fullstack",
      framework: fs[1],
      detail: `${fs[1]} renders on a server, so it can't run in the live preview yet — we're working on it. You can still chat with Astra to read, explain, and edit this project.`,
    };
  }

  // 3. Plain static site (HTML/CSS/JS, no framework) — serve it directly.
  //    This covers vanilla sites with or without a package.json.
  const looksNonWeb = lowerPaths.some((p) =>
    NON_WEB_MANIFESTS.some((m) => p === m || p.endsWith("/" + m)),
  );
  if (entryHtml && !looksNonWeb) {
    return {
      status: "static",
      framework: "Static site",
      detail: "A static site — serving it live below.",
      entryHtml,
    };
  }

  // 4. Recognized backend / other-language manifest — not a web preview.
  if (looksNonWeb || !hasPackageJson) {
    return {
      status: "non-web",
      framework: "Unknown",
      detail:
        "This doesn't look like a web app we can run in the browser. Ren Code previews web apps today — you can still chat with Astra to read and edit this project, and more project types are coming.",
    };
  }

  // 5. Has a package.json but no recognizable web entry — likely a library or
  //    a build-step app we can't bundle client-side yet.
  return {
    status: "fullstack",
    framework: "Web",
    detail:
      "We couldn't find a client-side entry point to run live just yet. Ren Code previews React and static web apps today — you can still chat with Astra to work on this project.",
  };
}
