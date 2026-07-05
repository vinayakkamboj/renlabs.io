/**
 * Dependency + entry resolution for the live preview.
 *
 * The preview runs in an in-browser bundler that resolves packages from a CDN
 * (no `npm install` step). To make an arbitrary imported project "just run", we:
 *   1. read its declared dependencies (package.json),
 *   2. scan its source for any imported package that ISN'T declared, and add it,
 *   3. find the real entry file (projects differ: main.tsx, index.jsx, …).
 *
 * This is the "auto-install missing dependencies" behaviour: anything the code
 * imports is made available to the bundler so the app compiles and renders.
 */

import { STANDARD_DEPENDENCIES } from "./base-template";
import type { ProjectFile } from "./types";

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "crypto", "http", "https", "stream", "util", "events",
  "child_process", "url", "querystring", "zlib", "buffer", "process", "assert",
  "net", "tls", "dns", "module", "perf_hooks", "worker_threads", "readline",
  "node:fs", "node:path", "node:crypto", "node:url", "node:stream",
]);

// Build-time / non-runtime packages that should never be fetched as CDN deps.
const DENYLIST = new Set([
  "tailwindcss", "vite", "@vitejs/plugin-react", "@vitejs/plugin-react-swc",
  "typescript", "eslint", "postcss", "autoprefixer", "prettier",
  "@types/react", "@types/react-dom", "@types/node",
]);

const IMPORT_RE =
  /(?:import\s+(?:[\w*\s{},]+\s+from\s+)?|export\s+(?:[\w*\s{},]+\s+from\s+)|require\(\s*|import\(\s*)["']([^"']+)["']/g;

function packageName(spec: string): string | null {
  if (!spec || spec.startsWith(".") || spec.startsWith("/")) return null;
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return spec.split("/")[0];
}

/**
 * Merge declared dependencies with any packages the source imports but doesn't
 * declare (added at "latest" so the bundler can resolve them from the CDN).
 */
export function collectDependencies(
  files: ProjectFile[],
): Record<string, string> {
  let deps: Record<string, string> = { ...STANDARD_DEPENDENCIES };

  // 1. Declared dependencies from package.json.
  const pkg = files.find(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json"),
  );
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg.content) as {
        dependencies?: Record<string, string>;
      };
      deps = { ...deps, ...(parsed.dependencies ?? {}) };
    } catch {
      /* keep standard deps */
    }
  }

  // 2. Imported-but-undeclared packages.
  for (const f of files) {
    if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(f.path)) continue;
    if (/\.config\.(t|j)s$/.test(f.path) || f.path.endsWith("vite.config.ts"))
      continue;

    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_RE.exec(f.content)) !== null) {
      const name = packageName(m[1]);
      if (!name) continue;
      if (NODE_BUILTINS.has(name) || DENYLIST.has(name)) continue;
      if (name.startsWith("@types/")) continue;
      if (!deps[name]) deps[name] = "latest";
    }
  }

  return deps;
}

const ENTRY_CANDIDATES = [
  "src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js",
  "src/index.tsx", "src/index.jsx", "src/index.ts", "src/index.js",
  "index.tsx", "index.jsx", "index.ts", "index.js",
  "src/App.tsx", "src/App.jsx",
];

/** Find the project's real client entry file. */
export function detectEntry(files: ProjectFile[]): string {
  const has = (p: string) => files.some((f) => f.path === p);

  // Prefer the module script declared in index.html.
  const html = files.find(
    (f) => f.path === "index.html" || f.path.endsWith("/index.html"),
  );
  if (html) {
    const m = html.content.match(
      /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i,
    );
    if (m) {
      const src = m[1].replace(/^\.?\//, "");
      if (has(src)) return "/" + src;
      // Resolve relative to the html file's own directory (nested app shells
      // like frontend/index.html referencing ./src/main.tsx).
      const dir = html.path.includes("/")
        ? html.path.slice(0, html.path.lastIndexOf("/") + 1)
        : "";
      if (dir && has(dir + src)) return "/" + dir + src;
    }
  }

  for (const c of ENTRY_CANDIDATES) {
    if (has(c)) return "/" + c;
  }

  // Nested client app (e.g. frontend/src/main.tsx added next to a backend) —
  // pick the shallowest main/index source file anywhere in the tree.
  const nested = files
    .map((f) => f.path)
    .filter((p) => /(^|\/)(main|index)\.(tsx|jsx)$/.test(p))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (nested) return "/" + nested;

  return "/src/main.tsx";
}
