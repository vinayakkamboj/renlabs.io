/**
 * Base template — the files seeded into every brand-new Ren Code project.
 *
 * This is a generic, modern React + Vite + Tailwind starter. It is intentionally
 * framework-neutral (no product SDK) so the builder agent can shape it into any
 * application the user describes. The CSS exposes shadcn-style HSL design tokens
 * so generated components can use semantic Tailwind colors that the agent can
 * re-theme per app.
 */

import type { ProjectFile } from "./types";

/** The system file the agent must never touch — the runtime entry. */
export const PROTECTED_PATHS = ["src/main.tsx", "index.html", "vite.config.ts"];

/** Project memory file — the agent's persistent notes about the app. */
export const PROJECT_MEMORY_FILE = "REN.md";

/** Packages pre-installed in every preview sandbox. */
export const STANDARD_DEPENDENCIES: Record<string, string> = {
  react: "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.28.0",
  zustand: "^4.5.5",
  "lucide-react": "^0.469.0",
  clsx: "^2.1.1",
  "tailwind-merge": "^2.5.5",
  "framer-motion": "^11.15.0",
  "date-fns": "^4.1.0",
  recharts: "^2.13.0",
  "class-variance-authority": "^0.7.1",
};

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ren Code App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: ["class"],
        theme: {
          extend: {
            colors: {
              background: "hsl(var(--background) / <alpha-value>)",
              foreground: "hsl(var(--foreground) / <alpha-value>)",
              card: { DEFAULT: "hsl(var(--card) / <alpha-value>)", foreground: "hsl(var(--card-foreground) / <alpha-value>)" },
              popover: { DEFAULT: "hsl(var(--popover) / <alpha-value>)", foreground: "hsl(var(--popover-foreground) / <alpha-value>)" },
              primary: { DEFAULT: "hsl(var(--primary) / <alpha-value>)", foreground: "hsl(var(--primary-foreground) / <alpha-value>)" },
              secondary: { DEFAULT: "hsl(var(--secondary) / <alpha-value>)", foreground: "hsl(var(--secondary-foreground) / <alpha-value>)" },
              muted: { DEFAULT: "hsl(var(--muted) / <alpha-value>)", foreground: "hsl(var(--muted-foreground) / <alpha-value>)" },
              accent: { DEFAULT: "hsl(var(--accent) / <alpha-value>)", foreground: "hsl(var(--accent-foreground) / <alpha-value>)" },
              destructive: { DEFAULT: "hsl(var(--destructive) / <alpha-value>)", foreground: "hsl(var(--destructive-foreground) / <alpha-value>)" },
              border: "hsl(var(--border) / <alpha-value>)",
              input: "hsl(var(--input) / <alpha-value>)",
              ring: "hsl(var(--ring) / <alpha-value>)",
            },
            borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
            fontFamily: { sans: ["var(--font-sans,system-ui)", "sans-serif"] },
          },
        },
      };
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const MAIN_TSX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

const INDEX_CSS = `/* ── FONT: The build agent MUST replace this with a Google Font import ──────
   e.g. @import url("https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,400&display=swap");
   Never ship with the system-ui fallback — always set a real Google Font.      */

/* Design tokens — the build agent sets ALL values during its design phase.
   Components use semantic classes (bg-primary, text-foreground, bg-card,
   border-border) — never hardcoded colors. */
:root {
  --background: 210 17% 98%;
  --foreground: 220 30% 10%;
  --card: 0 0% 100%;
  --card-foreground: 220 30% 10%;
  --popover: 0 0% 100%;
  --popover-foreground: 220 30% 10%;
  --primary: 262 83% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 210 14% 93%;
  --secondary-foreground: 220 20% 20%;
  --muted: 210 14% 93%;
  --muted-foreground: 220 12% 48%;
  --accent: 262 60% 95%;
  --accent-foreground: 262 83% 48%;
  --destructive: 0 78% 55%;
  --destructive-foreground: 0 0% 100%;
  --border: 214 16% 88%;
  --input: 214 16% 88%;
  --ring: 262 83% 60%;
  --radius: 0.75rem;
}

[data-theme="dark"] {
  --background: 220 25% 8%;
  --foreground: 220 15% 94%;
  --card: 220 22% 11%;
  --card-foreground: 220 15% 94%;
  --popover: 220 22% 11%;
  --popover-foreground: 220 15% 94%;
  --primary: 262 85% 68%;
  --primary-foreground: 220 25% 8%;
  --secondary: 220 18% 16%;
  --secondary-foreground: 220 15% 94%;
  --muted: 220 18% 16%;
  --muted-foreground: 220 12% 55%;
  --accent: 262 30% 22%;
  --accent-foreground: 262 85% 78%;
  --destructive: 0 75% 60%;
  --destructive-foreground: 220 15% 94%;
  --border: 220 18% 20%;
  --input: 220 18% 20%;
  --ring: 262 85% 68%;
}

* { box-sizing: border-box; margin: 0; padding: 0; border-color: hsl(var(--border)); }
html, body { width: 100%; height: 100%; }
#root { width: 100%; height: 100%; display: flex; flex-direction: column; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  -webkit-font-smoothing: antialiased;
}`;

const UTILS_TS = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`;

const APP_TSX = `import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Blank-canvas launchpad. There is no product here yet — this is the starting
 * point. Describe what you want in the chat and Ren Code replaces this entire
 * screen with your real app: a landing page, a SaaS dashboard, a marketplace,
 * a game, a tool — anything.
 */
const IDEAS = [
  "A task board with drag-and-drop",
  "A finance dashboard with charts",
  "A travel booking marketplace",
  "A real-time chat app",
];

export default function App() {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-background px-6">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-[320px] rounded-full bg-accent/30 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-2xl py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-widest text-primary backdrop-blur">
          <Sparkles className="size-3.5" />
          Your canvas is ready
        </span>

        <h1 className="mt-7 bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-[3.5rem] font-black leading-[1.04] tracking-tight text-transparent sm:text-[4.25rem]">
          Begin here.
        </h1>

        <p className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground">
          This is a blank slate — not a fixed app. Tell Ren Code what you want to
          build and watch it come to life, fully designed and working.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          {IDEAS.map((idea) => (
            <span
              key={idea}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3.5 py-2 text-[13px] font-medium text-foreground backdrop-blur transition-colors hover:border-primary/40"
            >
              <ArrowRight className="size-3.5 text-primary" />
              {idea}
            </span>
          ))}
        </div>

        <p className="mt-10 text-[13px] text-muted-foreground/70">
          Describe your idea in the chat to start →
        </p>
      </div>
    </div>
  );
}`;

const PACKAGE_JSON = JSON.stringify(
  {
    name: "ren-code-app",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^6.28.0",
      zustand: "^4.5.5",
      "lucide-react": "^0.469.0",
      clsx: "^2.1.1",
      "tailwind-merge": "^2.5.5",
      "framer-motion": "^11.15.0",
      "date-fns": "^4.1.0",
      recharts: "^2.13.0",
      three: "^0.171.0",
      "@react-three/fiber": "^8.17.10",
      "@react-three/drei": "^9.117.3",
    },
  },
  null,
  2,
);

const PROJECT_MEMORY = `# Project Memory

This file is Ren Code's persistent memory for this app. The agent reads it before
every change and updates it whenever files change.

## Overview

A blank canvas. \`src/App.tsx\` currently holds only a "Begin here" launchpad screen — there is
NO product yet. The first build replaces this entirely with whatever the user describes (landing
page, SaaS app, marketplace, game, tool, dashboard, etc.). Do not preserve the launchpad screen;
it exists only as a starting placeholder.

## Architecture (target — build into this on the first request)

- \`src/App.tsx\` — thin: HashRouter + Routes + top Navbar/Footer layout only. No UI logic here.
- \`src/index.css\` — design tokens (\`:root\` + \`[data-theme="dark"]\`) and base styles.
- \`src/lib/utils.ts\` — the \`cn()\` className helper.
- \`src/pages/\` — one file per route/view.
- \`src/components/\` — shared UI: \`layout/\` for Navbar/Footer/wrappers, \`ui/\` for primitives, feature subdirs.
- \`src/stores/\` — Zustand stores, one per domain (e.g. \`useAppStore.ts\`).
- \`src/data/\` — mock data and TypeScript types (\`types.ts\` + per-domain files).
- \`src/hooks/\` — custom React hooks.

## Routing

Use react-router-dom v6 with **HashRouter** (reliable inside the preview iframe). Default to a
top navigation bar (not a sidebar) — the brand logo links to \`/\` and \`NavLink\`s switch pages.
Use a sidebar layout ONLY when the product is genuinely an app dashboard/admin tool. The launchpad
screen has no routing yet — the first build introduces App.tsx routing for the real product.

## State

No Zustand stores yet — add in \`src/stores/\` when state is shared across components.

## Conventions

- Tailwind utilities use semantic tokens (\`bg-primary\`, \`text-foreground\`, \`border-border\`, etc.).
- Only \`src/index.css\` :root holds raw HSL values — never hardcode colors in components.
- Navigation uses \`NavLink\` / \`Link\` from react-router-dom (not \`<a href>\`).
- Shared state → Zustand store. Local UI state → useState.
- Mock data lives in \`src/data/\` — never inline large datasets in components.
`;

/**
 * Build the seed file set for a brand-new project.
 */
export function createBaseTemplate(): ProjectFile[] {
  return [
    { path: "index.html", content: INDEX_HTML },
    { path: "package.json", content: PACKAGE_JSON },
    { path: "src/main.tsx", content: MAIN_TSX },
    { path: "src/index.css", content: INDEX_CSS },
    { path: "src/App.tsx", content: APP_TSX },
    { path: "src/lib/utils.ts", content: UTILS_TS },
    { path: PROJECT_MEMORY_FILE, content: PROJECT_MEMORY },
  ];
}
