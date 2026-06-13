/**
 * Repository Intelligence — general-purpose static analysis of a repository's
 * file tree (paths only, no content required).
 *
 * Given a list of file paths, it classifies each file by role, detects the
 * tech stack, infers the architectural scope, and surfaces potential risks.
 * Results can be serialized as a prompt fragment for an LLM.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileRole =
  | "entry"
  | "page"
  | "layout"
  | "component"
  | "hook"
  | "service"
  | "store"
  | "utility"
  | "types"
  | "config"
  | "api"
  | "middleware"
  | "test"
  | "style"
  | "data"
  | "schema"
  | "document"
  | "other";

export interface TechStack {
  framework: "nextjs" | "react" | "vue" | "angular" | "svelte" | "unknown";
  language: "typescript" | "javascript" | "mixed" | "unknown";
  styling:
    | "tailwind"
    | "css-modules"
    | "styled-components"
    | "plain-css"
    | "unknown";
  stateManagement:
    | "zustand"
    | "redux"
    | "jotai"
    | "recoil"
    | "context"
    | "none";
  orm: "prisma" | "drizzle" | "typeorm" | "none";
  testing: "jest" | "vitest" | "cypress" | "playwright" | "none";
  auth: "supabase" | "nextauth" | "clerk" | "firebase" | "none";
  database:
    | "supabase"
    | "planetscale"
    | "neon"
    | "turso"
    | "mongodb"
    | "sqlite"
    | "none";
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  routing:
    | "app-router"
    | "pages-router"
    | "react-router"
    | "tanstack-router"
    | "unknown";
}

export type ArchitectureScope =
  | "empty"
  | "library"
  | "focused-app"
  | "full-product"
  | "monorepo"
  | "api-only"
  | "unknown";

export interface ArchitectureSummary {
  scope: ArchitectureScope;
  directories: string[];
  entrypoints: string[];
  pageCount: number;
  componentCount: number;
  hasTests: boolean;
  hasApiRoutes: boolean;
  description: string;
}

export interface FileNode {
  path: string;
  role: FileRole;
  language: "ts" | "tsx" | "js" | "jsx" | "css" | "scss" | "json" | "md" | "other";
}

export interface RepositoryIntelligence {
  files: FileNode[];
  /** Top-level directory names (unique) */
  fileTree: string[];
  techStack: TechStack;
  architecture: ArchitectureSummary;
  risks: string[];
  countsByRole: Record<FileRole, number>;
}

// ─── Language detection ───────────────────────────────────────────────────────

function detectLanguage(path: string): FileNode["language"] {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".jsx")) return "jsx";
  if (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".cjs"))
    return "js";
  if (path.endsWith(".scss") || path.endsWith(".sass")) return "scss";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md") || path.endsWith(".mdx")) return "md";
  return "other";
}

// ─── Role classification ──────────────────────────────────────────────────────

/**
 * Classify a single file path by its architectural role.
 * Operates on path strings only — no file content is read.
 */
export function classifyRole(path: string): FileRole {
  const lower = path.toLowerCase();
  const segments = path.split("/");
  const filename = segments[segments.length - 1];
  const filenameLower = filename.toLowerCase();

  // ── Tests ─────────────────────────────────────────────────────────────────
  if (
    filenameLower.includes(".test.") ||
    filenameLower.includes(".spec.") ||
    lower.includes("/__tests__/") ||
    lower.includes("/test/") ||
    lower.includes("/tests/") ||
    lower.includes("/e2e/") ||
    lower.includes("/cypress/") ||
    lower.includes("/playwright/")
  ) {
    return "test";
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  if (
    filenameLower.endsWith(".css") ||
    filenameLower.endsWith(".scss") ||
    filenameLower.endsWith(".sass") ||
    filenameLower.endsWith(".less")
  ) {
    return "style";
  }

  // ── Config files ──────────────────────────────────────────────────────────
  if (
    filenameLower === "package.json" ||
    filenameLower === "package-lock.json" ||
    filenameLower === "yarn.lock" ||
    filenameLower === "pnpm-lock.yaml" ||
    filenameLower === "bun.lockb" ||
    filenameLower === "tsconfig.json" ||
    filenameLower.startsWith("tsconfig.") ||
    filenameLower === "next.config.ts" ||
    filenameLower === "next.config.js" ||
    filenameLower === "next.config.mjs" ||
    filenameLower === "tailwind.config.ts" ||
    filenameLower === "tailwind.config.js" ||
    filenameLower === "tailwind.config.cjs" ||
    filenameLower === "postcss.config.js" ||
    filenameLower === "postcss.config.mjs" ||
    filenameLower === "eslint.config.js" ||
    filenameLower === ".eslintrc.js" ||
    filenameLower === ".eslintrc.json" ||
    filenameLower === ".prettierrc" ||
    filenameLower === ".prettierrc.js" ||
    filenameLower === ".prettierrc.json" ||
    filenameLower === "vite.config.ts" ||
    filenameLower === "vite.config.js" ||
    filenameLower === "vitest.config.ts" ||
    filenameLower === "jest.config.ts" ||
    filenameLower === "jest.config.js" ||
    filenameLower === "jest.setup.ts" ||
    filenameLower === ".env.example" ||
    filenameLower === ".env.local" ||
    filenameLower === "dockerfile" ||
    filenameLower === "docker-compose.yml" ||
    filenameLower === "docker-compose.yaml" ||
    filenameLower === ".gitignore" ||
    filenameLower === ".gitattributes" ||
    lower.includes("/.github/") ||
    lower.includes("/config/") ||
    filenameLower.endsWith(".config.ts") ||
    filenameLower.endsWith(".config.js") ||
    filenameLower.endsWith(".config.mjs")
  ) {
    return "config";
  }

  // ── Schema / migrations ───────────────────────────────────────────────────
  if (
    filenameLower.endsWith(".prisma") ||
    lower.includes("/migrations/") ||
    lower.includes("/drizzle/") ||
    filenameLower === "schema.prisma" ||
    filenameLower.includes("migration") ||
    lower.includes("/db/schema") ||
    lower.includes("/database/schema")
  ) {
    return "schema";
  }

  // ── Documentation / markdown ──────────────────────────────────────────────
  if (
    filenameLower.endsWith(".md") ||
    filenameLower.endsWith(".mdx") ||
    filenameLower === "readme" ||
    lower.includes("/docs/") ||
    lower.includes("/documentation/")
  ) {
    return "document";
  }

  // ── Data / mock / seed / fixture ──────────────────────────────────────────
  if (
    lower.includes("/mock") ||
    lower.includes("/mocks/") ||
    lower.includes("/seed") ||
    lower.includes("/seeds/") ||
    lower.includes("/fixture") ||
    lower.includes("/fixtures/") ||
    filenameLower.includes("mock") ||
    filenameLower.includes("seed") ||
    filenameLower.includes("fixture") ||
    filenameLower.includes("stub") ||
    lower.includes("/data/") ||
    lower.includes("/fake")
  ) {
    return "data";
  }

  // ── Types / declarations ──────────────────────────────────────────────────
  if (
    filenameLower.endsWith(".d.ts") ||
    lower.includes("/types/") ||
    lower.includes("/typings/") ||
    filenameLower === "types.ts" ||
    filenameLower === "types.tsx" ||
    filenameLower === "index.d.ts" ||
    filenameLower.startsWith("types.") ||
    filenameLower.endsWith(".types.ts") ||
    filenameLower.endsWith(".types.tsx")
  ) {
    return "types";
  }

  // ── State management / store ──────────────────────────────────────────────
  if (
    lower.includes("/store/") ||
    lower.includes("/stores/") ||
    lower.includes("/state/") ||
    lower.includes("/redux/") ||
    lower.includes("/slices/") ||
    filenameLower === "store.ts" ||
    filenameLower === "store.tsx" ||
    filenameLower.endsWith(".store.ts") ||
    filenameLower.endsWith(".store.tsx") ||
    filenameLower.endsWith("slice.ts") ||
    filenameLower.endsWith("slice.tsx") ||
    filenameLower.endsWith(".atom.ts") ||
    filenameLower.endsWith(".atom.tsx")
  ) {
    return "store";
  }

  // ── Hooks ─────────────────────────────────────────────────────────────────
  if (
    lower.includes("/hooks/") ||
    lower.includes("/hook/") ||
    filenameLower.startsWith("use") ||
    filenameLower.match(/^use[A-Z]/)
  ) {
    return "hook";
  }

  // ── API routes ────────────────────────────────────────────────────────────
  // Next.js App Router: /api/ folder with route.ts|js
  if (
    (lower.includes("/api/") && (filenameLower === "route.ts" || filenameLower === "route.js")) ||
    // Next.js Pages Router
    (lower.includes("/pages/api/") && (filenameLower.endsWith(".ts") || filenameLower.endsWith(".js")))
  ) {
    return "api";
  }

  // ── Middleware ────────────────────────────────────────────────────────────
  if (
    (filenameLower === "middleware.ts" || filenameLower === "middleware.js") &&
    segments.length <= 3 // root-level or src-level
  ) {
    return "middleware";
  }

  // ── Entry points ──────────────────────────────────────────────────────────
  if (
    filenameLower === "main.tsx" ||
    filenameLower === "main.ts" ||
    filenameLower === "main.jsx" ||
    filenameLower === "main.js" ||
    filenameLower === "index.tsx" ||
    filenameLower === "index.ts" ||
    filenameLower === "app.tsx" ||
    filenameLower === "app.ts" ||
    filenameLower === "_app.tsx" ||
    filenameLower === "_app.ts" ||
    (lower.includes("/app/") && filenameLower === "layout.tsx" && segments.filter(s => s === "app").length === 1) ||
    (path === "app/layout.tsx" || path === "src/app/layout.tsx")
  ) {
    return "entry";
  }

  // ── Services / lib ────────────────────────────────────────────────────────
  if (
    lower.includes("/services/") ||
    lower.includes("/service/") ||
    lower.includes("/server/") ||
    (lower.includes("/lib/") && !lower.includes("/supabase/"))
  ) {
    return "service";
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  if (
    lower.includes("/utils/") ||
    lower.includes("/util/") ||
    lower.includes("/helpers/") ||
    lower.includes("/helper/") ||
    filenameLower === "utils.ts" ||
    filenameLower === "utils.tsx" ||
    filenameLower === "helpers.ts" ||
    filenameLower.endsWith(".utils.ts") ||
    filenameLower.endsWith(".helpers.ts") ||
    filenameLower.includes("formatter") ||
    filenameLower.includes("format.ts")
  ) {
    return "utility";
  }

  // ── Pages ─────────────────────────────────────────────────────────────────
  // Next.js App Router page files
  if (filenameLower === "page.tsx" || filenameLower === "page.ts" || filenameLower === "page.jsx" || filenameLower === "page.js") {
    return "page";
  }
  // Next.js Pages Router
  if (
    lower.includes("/pages/") &&
    !lower.includes("/pages/api/") &&
    (filenameLower.endsWith(".tsx") || filenameLower.endsWith(".ts") || filenameLower.endsWith(".jsx") || filenameLower.endsWith(".js"))
  ) {
    return "page";
  }

  // ── Layouts ───────────────────────────────────────────────────────────────
  if (
    filenameLower === "layout.tsx" ||
    filenameLower === "layout.ts" ||
    filenameLower === "layout.jsx" ||
    filenameLower === "layout.js" ||
    filenameLower === "_document.tsx" ||
    filenameLower === "_document.ts" ||
    filenameLower.endsWith(".layout.tsx") ||
    filenameLower.endsWith(".layout.ts")
  ) {
    return "layout";
  }

  // ── Components ────────────────────────────────────────────────────────────
  if (
    lower.includes("/components/") ||
    lower.includes("/component/") ||
    lower.includes("/ui/") ||
    (filenameLower.endsWith(".tsx") && filenameLower[0] === filenameLower[0].toUpperCase())
  ) {
    return "component";
  }

  return "other";
}

// ─── Tech stack detection ─────────────────────────────────────────────────────

function detectTechStack(paths: string[]): TechStack {
  const all = paths.join("\n").toLowerCase();
  const filenames = paths.map(p => p.split("/").pop()?.toLowerCase() ?? "");

  // Framework
  let framework: TechStack["framework"] = "unknown";
  if (filenames.some(f => f === "next.config.ts" || f === "next.config.js" || f === "next.config.mjs") ||
      all.includes("/app/layout.tsx") || all.includes("src/app/layout.tsx")) {
    framework = "nextjs";
  } else if (all.includes("nuxt.config") || all.includes("/pages/") && all.includes("/.nuxt/")) {
    framework = "vue"; // nuxt
  } else if (all.includes("angular.json") || all.includes("/src/app.component.ts")) {
    framework = "angular";
  } else if (all.includes("svelte.config") || all.includes(".svelte")) {
    framework = "svelte";
  } else if (all.includes("vite.config") || all.includes("/src/app.tsx") || all.includes("/src/main.tsx")) {
    framework = "react";
  }

  // Language
  const tsFiles = paths.filter(p => p.endsWith(".ts") || p.endsWith(".tsx")).length;
  const jsFiles = paths.filter(p => p.endsWith(".js") || p.endsWith(".jsx")).length;
  let language: TechStack["language"] = "unknown";
  if (tsFiles > 0 && jsFiles > 0) language = "mixed";
  else if (tsFiles > 0) language = "typescript";
  else if (jsFiles > 0) language = "javascript";

  // Styling
  let styling: TechStack["styling"] = "unknown";
  if (filenames.some(f => f?.startsWith("tailwind.config"))) {
    styling = "tailwind";
  } else if (paths.some(p => p.endsWith(".module.css") || p.endsWith(".module.scss"))) {
    styling = "css-modules";
  } else if (all.includes("styled-components") || all.includes("/styled/")) {
    styling = "styled-components";
  } else if (paths.some(p => p.endsWith(".css"))) {
    styling = "plain-css";
  }

  // State management
  let stateManagement: TechStack["stateManagement"] = "none";
  if (all.includes("zustand") || all.includes("/store/")) stateManagement = "zustand";
  else if (all.includes("redux") || all.includes("/slices/") || all.includes("createslice")) stateManagement = "redux";
  else if (all.includes("jotai") || all.includes(".atom.ts")) stateManagement = "jotai";
  else if (all.includes("recoil")) stateManagement = "recoil";
  else if (all.includes("context")) stateManagement = "context";

  // ORM
  let orm: TechStack["orm"] = "none";
  if (filenames.some(f => f === "schema.prisma") || all.includes(".prisma")) orm = "prisma";
  else if (all.includes("/drizzle/") || filenames.some(f => f?.startsWith("drizzle.config"))) orm = "drizzle";
  else if (all.includes("typeorm") || all.includes("entity.ts")) orm = "typeorm";

  // Testing
  let testing: TechStack["testing"] = "none";
  if (filenames.some(f => f === "vitest.config.ts" || f === "vitest.config.js")) testing = "vitest";
  else if (filenames.some(f => f === "jest.config.ts" || f === "jest.config.js" || f === "jest.setup.ts")) testing = "jest";
  else if (all.includes("/cypress/")) testing = "cypress";
  else if (all.includes("/playwright/") || filenames.some(f => f === "playwright.config.ts")) testing = "playwright";

  // Auth
  let auth: TechStack["auth"] = "none";
  if (all.includes("/supabase/") || all.includes("@supabase/")) auth = "supabase";
  else if (all.includes("next-auth") || all.includes("nextauth") || all.includes("[...nextauth]")) auth = "nextauth";
  else if (all.includes("clerk")) auth = "clerk";
  else if (all.includes("firebase")) auth = "firebase";

  // Database
  let database: TechStack["database"] = "none";
  if (all.includes("supabase")) database = "supabase";
  else if (all.includes("planetscale")) database = "planetscale";
  else if (all.includes("neon")) database = "neon";
  else if (all.includes("turso") || all.includes("libsql")) database = "turso";
  else if (all.includes("mongodb") || all.includes("mongoose")) database = "mongodb";
  else if (all.includes("sqlite") || all.includes(".db")) database = "sqlite";

  // Package manager
  let packageManager: TechStack["packageManager"] = "npm";
  if (filenames.some(f => f === "pnpm-lock.yaml" || f === "pnpm-workspace.yaml")) packageManager = "pnpm";
  else if (filenames.some(f => f === "yarn.lock")) packageManager = "yarn";
  else if (filenames.some(f => f === "bun.lockb" || f === "bun.lock")) packageManager = "bun";

  // Routing
  let routing: TechStack["routing"] = "unknown";
  if (paths.some(p => p.includes("/app/") && p.endsWith("page.tsx"))) routing = "app-router";
  else if (paths.some(p => p.includes("/pages/") && !p.includes("/pages/api/"))) routing = "pages-router";
  else if (all.includes("react-router") || all.includes("browserrouter")) routing = "react-router";
  else if (all.includes("tanstack") && all.includes("router")) routing = "tanstack-router";

  return {
    framework,
    language,
    styling,
    stateManagement,
    orm,
    testing,
    auth,
    database,
    packageManager,
    routing,
  };
}

// ─── Architecture summary ─────────────────────────────────────────────────────

function buildArchitectureSummary(
  files: FileNode[],
  paths: string[],
): ArchitectureSummary {
  const topDirs = Array.from(
    new Set(paths.map(p => p.split("/")[0]).filter(Boolean)),
  );

  const entrypoints = files
    .filter(f => f.role === "entry")
    .map(f => f.path);

  const pageCount = files.filter(f => f.role === "page").length;
  const componentCount = files.filter(f => f.role === "component").length;
  const hasTests = files.some(f => f.role === "test");
  const hasApiRoutes = files.some(f => f.role === "api");

  // Infer scope
  let scope: ArchitectureScope = "unknown";
  const total = files.length;

  if (total === 0) {
    scope = "empty";
  } else if (topDirs.some(d => ["packages", "apps", "libs", "services"].includes(d))) {
    scope = "monorepo";
  } else if (hasApiRoutes && !pageCount && !componentCount) {
    scope = "api-only";
  } else if (
    !paths.some(p => p.includes("/components/") || p.includes("/pages/") || p.includes("/app/"))
  ) {
    scope = "library";
  } else if (pageCount <= 3 && componentCount <= 10) {
    scope = "focused-app";
  } else {
    scope = "full-product";
  }

  // Describe
  const parts: string[] = [];
  if (pageCount > 0) parts.push(`${pageCount} page${pageCount !== 1 ? "s" : ""}`);
  if (componentCount > 0) parts.push(`${componentCount} component${componentCount !== 1 ? "s" : ""}`);
  if (hasApiRoutes) parts.push("API routes");
  if (hasTests) parts.push("tests");

  const description =
    parts.length > 0
      ? `${scope.replace("-", " ")} with ${parts.join(", ")}`
      : scope.replace("-", " ");

  return {
    scope,
    directories: topDirs,
    entrypoints,
    pageCount,
    componentCount,
    hasTests,
    hasApiRoutes,
    description,
  };
}

// ─── Risk analysis ────────────────────────────────────────────────────────────

function identifyRisks(files: FileNode[], techStack: TechStack): string[] {
  const risks: string[] = [];

  if (!files.some(f => f.role === "test")) {
    risks.push("No test files detected — changes carry higher regression risk.");
  }

  if (!files.some(f => f.role === "types" || f.language === "ts" || f.language === "tsx")) {
    risks.push("No TypeScript detected — type safety is not enforced.");
  }

  const configFiles = files.filter(f => f.role === "config").map(f => f.path);
  const hasEnvExample = configFiles.some(p => p.toLowerCase().includes(".env.example"));
  const hasEnvLocal = configFiles.some(p => p.toLowerCase().includes(".env.local"));
  if (hasEnvLocal && !hasEnvExample) {
    risks.push(".env.local found without .env.example — configuration may not be documented.");
  }

  if (techStack.auth === "none" && techStack.database !== "none") {
    risks.push("Database detected without an auth layer — ensure RLS or middleware protects data.");
  }

  if (techStack.orm === "none" && techStack.database !== "none" && techStack.database !== "supabase") {
    risks.push("No ORM detected with a relational database — raw queries may need careful handling.");
  }

  if (files.length > 500) {
    risks.push("Large codebase (>500 files) — analysis may miss edge cases in deep paths.");
  }

  return risks;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Build a complete intelligence report from an array of file paths.
 * No file content is required — paths alone are sufficient.
 */
export function buildRepositoryIntelligence(
  paths: string[],
): RepositoryIntelligence {
  // Classify each file
  const files: FileNode[] = paths.map(path => ({
    path,
    role: classifyRole(path),
    language: detectLanguage(path),
  }));

  // Top-level directory tree
  const fileTree = Array.from(
    new Set(paths.map(p => p.split("/")[0]).filter(Boolean)),
  ).sort();

  // Tech stack detection
  const techStack = detectTechStack(paths);

  // Architecture summary
  const architecture = buildArchitectureSummary(files, paths);

  // Risks
  const risks = identifyRisks(files, techStack);

  // Counts by role
  const countsByRole = files.reduce(
    (acc, f) => {
      acc[f.role] = (acc[f.role] ?? 0) + 1;
      return acc;
    },
    {} as Record<FileRole, number>,
  );

  return { files, fileTree, techStack, architecture, risks, countsByRole };
}

// ─── Prompt serialization ─────────────────────────────────────────────────────

/**
 * Format a RepositoryIntelligence result as a concise text block suitable
 * for inclusion in an LLM prompt.
 */
export function formatIntelligenceForPrompt(
  intel: RepositoryIntelligence,
): string {
  const { techStack: ts, architecture: arch, countsByRole, risks } = intel;

  const lines: string[] = [
    "## Repository Intelligence",
    "",
    `**Scope:** ${arch.scope}`,
    `**Description:** ${arch.description}`,
    "",
    "### Tech Stack",
    `- Framework: ${ts.framework}`,
    `- Language: ${ts.language}`,
    `- Styling: ${ts.styling}`,
    `- State management: ${ts.stateManagement}`,
    `- ORM: ${ts.orm}`,
    `- Testing: ${ts.testing}`,
    `- Auth: ${ts.auth}`,
    `- Database: ${ts.database}`,
    `- Package manager: ${ts.packageManager}`,
    `- Routing: ${ts.routing}`,
    "",
    "### Structure",
    `- Top-level directories: ${intel.fileTree.join(", ") || "none"}`,
    `- Entrypoints: ${arch.entrypoints.join(", ") || "none"}`,
    `- Pages: ${arch.pageCount}`,
    `- Components: ${arch.componentCount}`,
    `- API routes: ${arch.hasApiRoutes ? "yes" : "no"}`,
    `- Tests: ${arch.hasTests ? "yes" : "no"}`,
    "",
    "### File breakdown",
    ...Object.entries(countsByRole)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([role, count]) => `- ${role}: ${count}`),
  ];

  if (risks.length > 0) {
    lines.push("", "### Risks", ...risks.map(r => `- ${r}`));
  }

  return lines.join("\n");
}
