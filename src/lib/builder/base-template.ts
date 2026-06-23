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
            fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
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

const INDEX_CSS = `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");

/* Default design system — a clean, modern, minimalist palette: cool slate
   neutrals with a single confident indigo accent. The build agent re-themes
   these tokens during its design phase to fit each product. */
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary: 243 75% 59%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 222 39% 16%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
  --accent: 226 100% 97%;
  --accent-foreground: 243 75% 45%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 243 75% 59%;
  --radius: 0.625rem;
}

[data-theme="dark"] {
  --background: 222 47% 7%;
  --foreground: 210 20% 96%;
  --card: 222 41% 10%;
  --card-foreground: 210 20% 96%;
  --popover: 222 41% 10%;
  --popover-foreground: 210 20% 96%;
  --primary: 245 80% 67%;
  --primary-foreground: 222 47% 7%;
  --secondary: 222 30% 16%;
  --secondary-foreground: 210 20% 96%;
  --muted: 222 30% 16%;
  --muted-foreground: 215 16% 62%;
  --accent: 222 33% 18%;
  --accent-foreground: 245 80% 80%;
  --destructive: 0 72% 56%;
  --destructive-foreground: 210 20% 96%;
  --border: 222 25% 20%;
  --input: 222 25% 20%;
  --ring: 245 80% 67%;
}

* { box-sizing: border-box; margin: 0; padding: 0; border-color: hsl(var(--border)); }
html, body { width: 100%; height: 100%; }
#root { width: 100%; height: 100%; display: flex; flex-direction: column; }
body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  -webkit-font-smoothing: antialiased;
}`;

const UTILS_TS = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`;

const APP_TSX = `import { HashRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { Sparkles, ArrowRight, Zap, Shield, Layers } from "lucide-react";
import { cn } from "./lib/utils";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/about", label: "About" },
];

function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Acme</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button className="hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex">
          Get started
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Acme. All rights reserved.</span>
        <div className="flex items-center gap-5">
          <Link to="/features" className="transition-colors hover:text-foreground">Features</Link>
          <Link to="/about" className="transition-colors hover:text-foreground">About</Link>
        </div>
      </div>
    </footer>
  );
}

const FEATURES = [
  { icon: Zap, title: "Fast by default", body: "Built for speed, so everything feels instant from the first interaction." },
  { icon: Shield, title: "Secure & private", body: "Your data stays yours. Sensible defaults that protect by design." },
  { icon: Layers, title: "Composable", body: "Clean building blocks that fit together however your product needs." },
];

function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Sparkles className="size-3 text-primary" /> Now in early access
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-foreground">
          The starting point for whatever you want to build.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Describe your idea and Ren Code shapes it into a real product — pages, navigation,
          state, and a design that fits.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Get started <ArrowRight className="size-4" />
          </button>
          <Link to="/features" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
            See features
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="size-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function FeaturesPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Features</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Everything you need, nothing you don't. Replace this with the real capabilities of your product.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">About</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
        This is a starter home page with a working top navigation bar. Tell Ren Code what you want to
        build and it will reshape this into your product — a landing page, a SaaS app, a marketplace,
        a tool, a dashboard, whatever fits.
      </p>
    </section>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-full flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </HashRouter>
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
    },
  },
  null,
  2,
);

const PROJECT_MEMORY = `# Project Memory

This file is Ren Code's persistent memory for this app. The agent reads it before
every change and updates it whenever files change.

## Overview

A fresh React + Vite + Tailwind starter: a real web app shell with a top navigation bar,
a home/landing page, and multi-page routing. No product purpose has been defined yet — the
first build reshapes this into whatever the user describes (landing page, SaaS app,
marketplace, tool, dashboard, etc.).

## Architecture

- \`src/App.tsx\` — thin: HashRouter + Routes + top Navbar + Footer layout only. No UI logic here.
- \`src/index.css\` — design tokens (\`:root\` + \`[data-theme="dark"]\`) and base styles.
- \`src/lib/utils.ts\` — the \`cn()\` className helper.
- \`src/pages/\` — one file per route/view.
- \`src/components/\` — shared UI: \`layout/\` for Navbar/Footer/wrappers, \`ui/\` for primitives, feature subdirs.
- \`src/stores/\` — Zustand stores, one per domain (e.g. \`useAppStore.ts\`).
- \`src/data/\` — mock data and TypeScript types (\`types.ts\` + per-domain files).
- \`src/hooks/\` — custom React hooks.

## Routing

Uses react-router-dom v6 with **HashRouter** (reliable inside the preview iframe). Layout is a
top navigation bar (not a sidebar) — the brand logo links to \`/\` and \`NavLink\`s switch pages.
Current routes:
- \`/\` — HomePage (hero + features)
- \`/features\` — FeaturesPage
- \`/about\` — AboutPage

Use a sidebar layout ONLY when the product is genuinely an app dashboard/admin tool; otherwise
keep the top-navbar + home-page shell.

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
