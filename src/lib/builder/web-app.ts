/**
 * Decides whether an imported project can run in the live preview.
 *
 * The preview runs a client-side React bundle in the browser (Sandpack), so it
 * can render React/Vite-style web apps directly. Full-stack frameworks that need
 * a server (Next.js, Remix, etc.) and non-web projects (backends, CLIs, mobile,
 * other languages) can't be previewed yet — we detect those and tell the user.
 */

import type { ProjectFile } from "./types";

export type PreviewStatus = "previewable" | "fullstack" | "non-web";

export interface WebAppAnalysis {
  status: PreviewStatus;
  framework: string;
  detail: string;
}

const NON_WEB_MANIFESTS = [
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "cargo.toml",
  "pom.xml",
  "build.gradle",
  "gemfile",
  "composer.json",
  "pubspec.yaml",
];

function readDeps(files: ProjectFile[]): string[] {
  const pkg = files.find(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json"),
  );
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

export function analyzeWebApp(files: ProjectFile[]): WebAppAnalysis {
  const deps = readDeps(files);
  const has = (name: string) => deps.includes(name);
  const lowerPaths = files.map((f) => f.path.toLowerCase());
  const hasHtml = lowerPaths.some((p) => p.endsWith(".html"));
  const hasPackageJson = files.some(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json"),
  );

  // Full-stack / server-rendered frameworks — can't run in the client sandbox yet.
  const fullstack: Array<[boolean, string]> = [
    [has("next"), "Next.js"],
    [has("nuxt") || has("nuxt3"), "Nuxt"],
    [has("@remix-run/react") || has("remix"), "Remix"],
    [has("@sveltejs/kit"), "SvelteKit"],
    [has("astro"), "Astro"],
    [has("@angular/core"), "Angular"],
    [has("vue") || has("vue3"), "Vue"],
    [has("svelte"), "Svelte"],
  ];
  const fs = fullstack.find(([yes]) => yes);

  // Client-side React app (Vite / CRA) — this is what the preview can run.
  const isReactClient =
    has("react") && has("react-dom") && !has("next") && !has("@remix-run/react");

  if (isReactClient) {
    return {
      status: "previewable",
      framework: "React",
      detail: "A client-side React app — running it live below.",
    };
  }

  if (fs) {
    return {
      status: "fullstack",
      framework: fs[1],
      detail: `Live preview for ${fs[1]} apps is coming soon. Ren Code currently previews client-side web apps — our team is working on making full-stack apps previewable. You can still chat with Astra to read and edit this project.`,
    };
  }

  // Plain web (HTML/JS) without a recognized framework — treat as not-yet-previewable web.
  if (hasHtml && hasPackageJson) {
    return {
      status: "fullstack",
      framework: "Web",
      detail:
        "This looks like a web project we can't preview live just yet. Ren Code currently previews client-side React apps — preview for more web setups is coming soon.",
    };
  }

  // Anything else (backends, CLIs, other languages, mobile) is not a web app.
  const looksNonWeb =
    !hasPackageJson ||
    lowerPaths.some((p) =>
      NON_WEB_MANIFESTS.some((m) => p === m || p.endsWith("/" + m)),
    );

  if (looksNonWeb) {
    return {
      status: "non-web",
      framework: "Unknown",
      detail:
        "This doesn't look like a web app. Ren Code currently only supports web apps — you can try again in the future, as our team is working on supporting full-stack and other project types.",
    };
  }

  return {
    status: "fullstack",
    framework: "Web",
    detail:
      "Live preview for this project type is coming soon. Ren Code currently previews client-side React apps.",
  };
}
