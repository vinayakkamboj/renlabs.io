/**
 * Detects the actual tech stack of an imported GitHub repository by reading
 * its package.json, config files, and README. The result feeds the repo-aware
 * system prompt so Astra understands the real framework conventions instead of
 * assuming a blank Vite/CDN-Tailwind setup.
 */

import type { ProjectFile } from "./types";

export interface RepoStackInfo {
  framework: string;
  devCommand: string;
  buildCommand: string;
  startCommand: string | null;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  hasTailwind: boolean;
  hasTypeScript: boolean;
  routingConvention: string;
  readmeExcerpt: string;
}

export function detectRepoStack(files: ProjectFile[]): RepoStackInfo {
  let scripts: Record<string, string> = {};
  let dependencies: string[] = [];
  let devDependencies: string[] = [];
  let readmeExcerpt = "";

  const pkg = files.find((f) => f.path === "package.json");
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg.content) as {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      scripts = parsed.scripts ?? {};
      dependencies = Object.keys(parsed.dependencies ?? {});
      devDependencies = Object.keys(parsed.devDependencies ?? {});
    } catch {
      /* unparseable package.json — leave defaults */
    }
  }

  const readme = files.find(
    (f) =>
      f.path.toLowerCase() === "readme.md" ||
      f.path.toLowerCase() === "readme.mdx" ||
      f.path.toLowerCase() === "readme",
  );
  if (readme) {
    readmeExcerpt = readme.content.split("\n").slice(0, 40).join("\n").trim();
  }

  const allDeps = [...dependencies, ...devDependencies];
  const paths = files.map((f) => f.path);

  // Framework detection — order matters (most specific first)
  let framework = "React";
  let routingConvention = "React Router or custom routing in src/";

  if (allDeps.includes("next")) {
    framework = "Next.js";
    // Detect App Router vs Pages Router by file presence
    const hasAppDir = paths.some(
      (p) => p.startsWith("app/") || p.startsWith("src/app/"),
    );
    const hasPagesDir = paths.some(
      (p) => p.startsWith("pages/") || p.startsWith("src/pages/"),
    );
    if (hasAppDir && !hasPagesDir) {
      routingConvention =
        "Next.js App Router — pages go in app/ as page.tsx, layouts as layout.tsx, API routes as route.ts inside app/api/";
    } else if (hasPagesDir) {
      routingConvention =
        "Next.js Pages Router — pages go in pages/, API routes in pages/api/";
    } else {
      routingConvention = "Next.js — check whether App Router (app/) or Pages Router (pages/) is used";
    }
  } else if (allDeps.some((d) => d === "@remix-run/react" || d === "remix")) {
    framework = "Remix";
    routingConvention = "Remix file-based routing in app/routes/";
  } else if (allDeps.includes("@sveltejs/kit")) {
    framework = "SvelteKit";
    routingConvention = "SvelteKit file-based routing in src/routes/";
  } else if (allDeps.includes("nuxt") || allDeps.includes("nuxt3")) {
    framework = "Nuxt";
    routingConvention = "Nuxt file-based routing in pages/";
  } else if (allDeps.includes("astro")) {
    framework = "Astro";
    routingConvention = "Astro file-based routing in src/pages/";
  } else if (allDeps.includes("vue") || allDeps.includes("vue3")) {
    framework = "Vue 3";
    routingConvention = "Vue Router — routes defined in src/router/";
  } else if (allDeps.includes("@angular/core")) {
    framework = "Angular";
    routingConvention = "Angular Router — routes defined in app-routing.module.ts";
  } else if (allDeps.includes("gatsby")) {
    framework = "Gatsby";
    routingConvention = "Gatsby file-based routing in src/pages/";
  } else if (
    devDependencies.includes("vite") ||
    paths.some((p) => p === "vite.config.ts" || p === "vite.config.js")
  ) {
    framework = "React + Vite";
    routingConvention = "Client-side routing in src/ (likely React Router or Tanstack Router)";
  }

  const hasTailwind =
    allDeps.some((d) => d === "tailwindcss") ||
    paths.some(
      (p) =>
        p === "tailwind.config.ts" ||
        p === "tailwind.config.js" ||
        p === "tailwind.config.cjs",
    );

  const hasTypeScript =
    paths.some((p) => p === "tsconfig.json") ||
    devDependencies.includes("typescript");

  const devCommand = scripts.dev ?? scripts.start ?? scripts.develop ?? "npm run dev";
  const buildCommand = scripts.build ?? "npm run build";
  const startCommand = scripts.start && scripts.start !== scripts.dev
    ? scripts.start
    : null;

  return {
    framework,
    devCommand,
    buildCommand,
    startCommand,
    scripts,
    dependencies,
    devDependencies,
    hasTailwind,
    hasTypeScript,
    routingConvention,
    readmeExcerpt,
  };
}
