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

const APP_TSX = `import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Home, LayoutDashboard, Settings, Menu } from "lucide-react";
import { cn } from "./lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-30 flex flex-col w-56 bg-card border-r border-border transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="h-14 flex items-center px-5 border-b border-border shrink-0">
          <span className="text-base font-semibold text-foreground">My App</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 p-10 text-center">
      <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Home className="size-7 text-primary" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Your app starts here</h1>
        <p className="max-w-md text-muted-foreground leading-relaxed">
          Describe what you want to build — Ren Code will architect the full product: pages, routing, state, and design.
        </p>
      </div>
    </div>
  );
}

function DashboardPage() {
  const stats = [
    { label: "Total Users", value: "1,284" },
    { label: "Revenue", value: "$4,830" },
    { label: "Active Now", value: "37" },
  ];
  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Overview of your key metrics.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-card border border-border p-5 flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-foreground">Settings</h2>
      <p className="text-sm text-muted-foreground">Manage your application preferences.</p>
    </div>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <BrowserRouter>
      <div className="flex h-full">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-background md:hidden">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="size-5" />
            </button>
            <span className="font-semibold text-foreground">My App</span>
          </header>
          <main className="flex flex-col flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
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

A fresh React + Vite + Tailwind starter with multi-page routing and state management.
No product purpose has been defined yet — the first build will shape it from the user's prompt.

## Architecture

- \`src/App.tsx\` — thin: BrowserRouter + Routes + Sidebar layout only. No UI logic here.
- \`src/index.css\` — design tokens (\`:root\` + \`[data-theme="dark"]\`) and base styles.
- \`src/lib/utils.ts\` — the \`cn()\` className helper.
- \`src/pages/\` — one file per route/view.
- \`src/components/\` — shared UI: \`layout/\` for wrappers, \`ui/\` for primitives, feature subdirs.
- \`src/stores/\` — Zustand stores, one per domain (e.g. \`useAppStore.ts\`).
- \`src/data/\` — mock data and TypeScript types (\`types.ts\` + per-domain files).
- \`src/hooks/\` — custom React hooks.

## Routing

Uses react-router-dom v6 (BrowserRouter + Routes + Route). Current routes:
- \`/\` — HomePage
- \`/dashboard\` — DashboardPage
- \`/settings\` — SettingsPage

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
