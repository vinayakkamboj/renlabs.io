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
            fontFamily: { sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"] },
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

const INDEX_CSS = `@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap");

/* Default design system — warm off-white background, near-black text, one
   confident violet accent. The build agent re-themes these tokens during its
   design phase. Components use semantic classes (bg-primary, text-foreground,
   bg-card, border-border) — never hardcoded colors. */
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
  font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
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
import { ArrowRight, Zap, Shield, Layers, BarChart2 } from "lucide-react";
import { cn } from "./lib/utils";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/about", label: "About" },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary">
        <BarChart2 className="size-4 text-primary-foreground" strokeWidth={2.5} />
      </span>
      <span className="text-[15px] font-bold tracking-tight text-foreground">Acme</span>
    </Link>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <Link
            to="/about"
            className="hidden text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            Sign in
          </Link>
          <button className="rounded-lg bg-primary px-4 py-2 text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Get started
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-[13px] text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-primary">
            <BarChart2 className="size-3 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <span className="font-semibold text-foreground">Acme</span>
          <span className="ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/features" className="transition-colors hover:text-foreground">Features</Link>
          <Link to="/about" className="transition-colors hover:text-foreground">About</Link>
        </div>
      </div>
    </footer>
  );
}

const FEATURES = [
  { icon: Zap, title: "Instant performance", body: "Every interaction is fast. No loading spinners, no wasted time." },
  { icon: Shield, title: "Built-in security", body: "Designed secure from day one — sensible defaults, no config required." },
  { icon: Layers, title: "Fully composable", body: "Modular building blocks that fit together exactly how your product needs." },
];

function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-28 text-center">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-primary">
          Now in early access
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-[3.25rem] font-extrabold leading-[1.1] tracking-tight text-foreground">
          The foundation for whatever you want to build.
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
          Describe your idea and Ren Code turns it into a complete, working product
          — pages, navigation, state, and a design that fits.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Get started free <ArrowRight className="size-4" />
          </button>
          <Link
            to="/features"
            className="rounded-xl border border-border px-6 py-3 text-[14px] font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            See features
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-7 transition-shadow hover:shadow-sm"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="size-5 text-primary" />
              </div>
              <h3 className="mt-5 text-[15px] font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function FeaturesPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <h1 className="text-[2rem] font-extrabold tracking-tight text-foreground">Features</h1>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
        Everything you need, nothing you don't. Replace this with the real capabilities of your product.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-5 rounded-2xl border border-border bg-card p-6">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AboutPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-[2rem] font-extrabold tracking-tight text-foreground">About</h1>
      <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
        This is a starter with a top navigation bar and working multi-page routing. Tell Ren Code
        what you want to build and it will reshape this into your product — a landing page, a SaaS
        app, a marketplace, a tool, a dashboard, whatever fits.
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
