"use client";

/**
 * Live preview — runs the generated project files in Sandpack.
 * The loading overlay is tied to Sandpack's real bundler state (it clears the
 * moment compilation reports "done"), and a collapsible bottom bar exposes the
 * console output and the installed dependency list.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewPane,
  SandpackConsole,
  useSandpack,
} from "@codesandbox/sandpack-react";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  FileCode2,
  Github,
  Loader2,
  Package,
  ScanSearch,
  Sparkles,
  Terminal,
} from "lucide-react";
import { collectDependencies, detectEntry } from "@/lib/builder/deps";
import {
  heuristicRepoProfile,
  repoContentHash,
  type RepoPreviewProfile,
} from "@/lib/builder/repo-preview-intel";
import { useWorkspaceStore } from "@/lib/builder/store";
import { ReadmeViewer } from "@/components/workspace/readme-viewer";
import type { ProjectFile } from "@/lib/builder/types";
import { cn } from "@/lib/utils";

interface PreviewProps {
  projectFiles: ProjectFile[];
  viewerKey: number;
  projectKind?: "new" | "repository";
  /** True when repo files were actually fetched from GitHub. False means the
   *  session was missing/expired and the blank template was shown as a fallback. */
  repoFilesLoaded?: boolean;
}

/**
 * Overlay shown while the sandbox boots. It listens to the real Sandpack
 * bundler messages and clears as soon as the app is compiled and running, so
 * the perceived wait is exactly the actual wait — no artificial delay.
 */
function BootOverlay({ depCount }: { depCount: number }) {
  const { listen } = useSandpack();
  const [done, setDone] = useState(false);
  const [label, setLabel] = useState("Starting sandbox");
  const [sub, setSub] = useState<string | null>(null);

  useEffect(() => {
    const stop = listen((msg) => {
      if (msg.type === "start") {
        setLabel("Resolving dependencies");
        setSub(`Fetching ${depCount} package${depCount !== 1 ? "s" : ""} from CDN`);
      }
      if (msg.type === "status" && "status" in msg) {
        const s = (msg as { status?: string }).status;
        if (s === "installing-dependencies") {
          setLabel("Installing dependencies");
          setSub(`${depCount} package${depCount !== 1 ? "s" : ""} — no npm install needed`);
        } else if (s === "transpiling") {
          setLabel("Compiling app");
          setSub("Building your project");
        } else if (s === "evaluating") {
          setLabel("Starting app");
          setSub(null);
        }
      }
      if (msg.type === "done") setDone(true);
    });
    return stop;
  }, [listen, depCount]);

  if (done) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-carbon">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2.5 text-[13px] text-dusk-muted">
          <Loader2 className="size-4 animate-spin text-brass" />
          {label}…
        </div>
        {sub && <p className="text-[11.5px] text-dusk-faint">{sub}</p>}
      </div>
    </div>
  );
}

function DepsPanel({ deps }: { deps: Record<string, string> }) {
  const entries = Object.entries(deps).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="platform-scroll h-full overflow-y-auto p-3">
      <p className="mb-2 px-0.5 font-mono text-[10px] uppercase tracking-widest text-dusk-faint">
        {entries.length} packages installed
      </p>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {entries.map(([name, version]) => (
          <div
            key={name}
            className="flex flex-col rounded-md border border-carbon-line bg-carbon-raised px-2.5 py-1.5"
          >
            <span className="truncate font-mono text-[11.5px] text-brass">{name}</span>
            <span className="font-mono text-[10.5px] text-dusk-faint">{version}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Watches the bundler for compile/runtime errors and offers a one-click fix:
 * the full error (message + file) is handed to Astra as a build request. This
 * closes the loop — a crash in the preview never requires the user to copy
 * error text around; the system feeds itself the diagnostics.
 */
function PreviewErrorBanner() {
  const { listen } = useSandpack();
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const isBuilding = useWorkspaceStore((s) => s.isBuilding);
  const [error, setError] = useState<{ title: string; message: string; path?: string } | null>(
    null,
  );

  useEffect(() => {
    return listen((msg) => {
      if (msg.type === "start") setError(null); // new compile — stale error gone
      if (msg.type === "action" && "action" in msg && msg.action === "show-error") {
        const e = msg as { title?: string; message?: string; path?: string };
        setError({
          title: e.title ?? "Build error",
          message: (e.message ?? "").slice(0, 1200),
          path: e.path,
        });
      }
    });
  }, [listen]);

  if (!error) return null;

  function fix() {
    if (isBuilding || !error) return;
    void sendMessage(
      `The live preview crashed. Find the ROOT CAUSE and fix it completely — check the named file first, then every related import/declaration.\n\n` +
        `Error: ${error.title}\n${error.message}` +
        (error.path ? `\nFile: ${error.path}` : ""),
    );
    setError(null);
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-signal-red/30 bg-signal-red/10 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-[11.5px] text-signal-red" title={error.message}>
        <span className="font-medium">{error.title}</span>
        {error.path && <span className="opacity-80"> · {error.path}</span>}
      </p>
      <button
        onClick={fix}
        disabled={isBuilding}
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-signal-red px-3 text-[11.5px] font-medium text-white transition-colors hover:bg-signal-red/85 disabled:opacity-50"
      >
        {isBuilding ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
        {isBuilding ? "Astra is fixing…" : "Fix with Astra"}
      </button>
    </div>
  );
}

function PreviewContent({ packageDeps }: { packageDeps: Record<string, string> }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<"console" | "deps">("console");

  function toggleTab(tab: "console" | "deps") {
    if (panelOpen && bottomTab === tab) {
      setPanelOpen(false);
    } else {
      setBottomTab(tab);
      setPanelOpen(true);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-carbon">
      {/* Preview */}
      <div className="relative min-h-0 flex-1">
        <BootOverlay depCount={Object.keys(packageDeps).length} />
        <SandpackPreviewPane
          showOpenInCodeSandbox={false}
          showRefreshButton={true}
          style={{ height: "100%", width: "100%" }}
        />
      </div>

      <PreviewErrorBanner />

      {/* Bottom panel */}
      {panelOpen && (
        <div className="h-48 shrink-0 overflow-hidden border-t border-carbon-line bg-carbon">
          {bottomTab === "console" ? (
            <SandpackConsole
              resetOnPreviewRestart
              style={{
                height: "100%",
                background: "transparent",
                color: "#97917f",
                fontSize: "12px",
                fontFamily: "ui-monospace, monospace",
              }}
            />
          ) : (
            <DepsPanel deps={packageDeps} />
          )}
        </div>
      )}

      {/* Status bar */}
      <div className="flex h-7 shrink-0 items-center gap-1 border-t border-carbon-line bg-carbon px-3">
        <StatusTab
          active={panelOpen && bottomTab === "console"}
          onClick={() => toggleTab("console")}
          icon={<Terminal className="size-3" />}
          label="Console"
        />
        <StatusTab
          active={panelOpen && bottomTab === "deps"}
          onClick={() => toggleTab("deps")}
          icon={<Package className="size-3" />}
          label="Dependencies"
        />
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="ml-auto text-dusk-faint transition-colors hover:text-dusk-muted"
        >
          {panelOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronUp className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function StatusTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "bg-carbon-high text-brass"
          : "text-dusk-faint hover:text-dusk-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Tailwind theme for the preview. Mirrors the token mapping baked into the base
 * template's index.html so generated apps can use the semantic color utilities
 * (`bg-primary`, `text-foreground`, …) that resolve to the HSL CSS variables
 * defined in src/index.css.
 */
const PREVIEW_TAILWIND_CONFIG = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
};

/**
 * Build the HTML shell served at /public/index.html. The Tailwind Play CDN is
 * injected separately via the SandpackProvider `externalResources` option (the
 * reliable mechanism in the classic bundler). This inline script just waits for
 * that CDN to appear and applies our theme config — robust to load ordering,
 * since the Play CDN re-generates styles whenever `tailwind.config` is set.
 */
function buildPreviewShell(): string {
  const cfg = JSON.stringify(PREVIEW_TAILWIND_CONFIG);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>
      (function () {
        var cfg = ${cfg};
        (function apply() {
          if (window.tailwind) {
            window.tailwind.config = cfg;
          } else {
            setTimeout(apply, 20);
          }
        })();
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

/**
 * Wrapper that decides how to preview a project. Generated apps are always our
 * client-side React template, so they run immediately. Imported repositories are
 * first analyzed — Astra reads the structure and dependencies — then either run
 * live (if it's a previewable web app) or show the README (if one exists) with
 * a note about why a live preview isn't available yet.
 */
export function LivePreview({ projectFiles, viewerKey, projectKind, repoFilesLoaded }: PreviewProps) {
  if (projectKind === "repository") {
    return (
      <RepoPreviewGate
        projectFiles={projectFiles}
        viewerKey={viewerKey}
        repoFilesLoaded={repoFilesLoaded ?? false}
      />
    );
  }
  return <SandpackRunner projectFiles={projectFiles} viewerKey={viewerKey} />;
}

const ANALYSIS_STEPS = [
  "Reading project files",
  "Detecting framework & dependencies",
  "Astra is analyzing the codebase",
  "Deciding how to run it",
];

const PROFILE_CACHE_PREFIX = "ren:repo-profile:";

/** Cached Astra verdict per file-set hash, so re-opening a project is instant
 *  and the model isn't re-asked for an unchanged repo. */
function readCachedProfile(hash: string): RepoPreviewProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_PREFIX + hash);
    if (!raw) return null;
    return (JSON.parse(raw) as { profile: RepoPreviewProfile }).profile ?? null;
  } catch {
    return null;
  }
}

function writeCachedProfile(hash: string, profile: RepoPreviewProfile) {
  try {
    localStorage.setItem(PROFILE_CACHE_PREFIX + hash, JSON.stringify({ profile, t: Date.now() }));
  } catch {
    /* storage full/unavailable — cache is best-effort */
  }
}

/**
 * The intelligence gate for attached repositories.
 *
 * Layered decision, no failure mode:
 *   1. A deterministic heuristic profile is computed instantly (always valid).
 *   2. Astra's analysis (/api/builder/analyze-repo) refines it — what the repo
 *      is, whether it has a frontend, how to run it. Timeout / error / offline
 *      all silently resolve to the heuristic profile.
 *   3. previewMode drives the surface: sandpack (live app), static (served
 *      site), or console (backend/library — code console + run commands +
 *      "want a frontend?" offer).
 */
function RepoPreviewGate({
  projectFiles,
  viewerKey,
  repoFilesLoaded,
}: {
  projectFiles: ProjectFile[];
  viewerKey: number;
  repoFilesLoaded: boolean;
}) {
  const heuristic = useMemo(() => heuristicRepoProfile(projectFiles), [projectFiles]);
  const hash = useMemo(() => repoContentHash(projectFiles), [projectFiles]);
  const [profile, setProfile] = useState<RepoPreviewProfile | null>(null);
  const [step, setStep] = useState(0);
  const hasProfileRef = useRef(false);
  hasProfileRef.current = profile !== null;

  useEffect(() => {
    if (!repoFilesLoaded || !projectFiles.length) return;

    const cached = readCachedProfile(hash);
    if (cached) {
      setProfile(cached);
      return;
    }

    // First load: show the analysis screen. After edits (hash changed but we
    // already have a profile) keep the current surface up and refine silently
    // in the background — never blank a working preview to re-analyze.
    if (!hasProfileRef.current) {
      setProfile(null);
    }
    setStep(0);
    const stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 900);

    let alive = true;
    (async () => {
      let resolved = heuristic;
      try {
        const res = await fetch("/api/builder/analyze-repo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Trim contents client-side too — the analysis reads structure and
          // key files, it doesn't need megabytes of source.
          body: JSON.stringify({
            files: projectFiles.map((f) => ({
              path: f.path,
              content: f.content.slice(0, 4_000),
            })),
          }),
          signal: AbortSignal.timeout(40_000),
        });
        if (res.ok) {
          const data = (await res.json()) as { profile?: RepoPreviewProfile };
          if (data.profile) resolved = data.profile;
        }
      } catch {
        /* network/timeout — heuristic stands */
      }
      if (!alive) return;
      writeCachedProfile(hash, resolved);
      setProfile(resolved);
    })();

    return () => {
      alive = false;
      clearInterval(stepTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, repoFilesLoaded]);

  // GitHub session was missing or expired — files couldn't be loaded.
  if (!repoFilesLoaded) {
    return <RepoLoadFailed />;
  }

  if (!profile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 bg-carbon px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brass/10 ring-1 ring-brass/20">
          <ScanSearch className="size-5 animate-pulse text-brass" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-dusk">
            Astra is understanding your project
          </p>
          <p className="mt-1 text-[12.5px] text-dusk-faint">
            {ANALYSIS_STEPS[step]}…
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {ANALYSIS_STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 w-6 rounded-full transition-colors",
                i <= step ? "bg-brass" : "bg-carbon-line-strong",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  if (profile.previewMode === "static") {
    return (
      <StaticRunner
        projectFiles={projectFiles}
        viewerKey={viewerKey}
        entryHtml={profile.entryPoint ?? "index.html"}
      />
    );
  }

  if (profile.previewMode === "sandpack") {
    return <SandpackRunner projectFiles={projectFiles} viewerKey={viewerKey} />;
  }

  // Console mode: backend / library / server-rendered — no browser preview.
  return <RepoConsole profile={profile} projectFiles={projectFiles} />;
}

/**
 * The "compiler" surface for repositories without a browser-runnable frontend:
 * what the project is (Astra's summary), how to build and run it, and — when
 * it has no frontend at all — the offer to have Astra add one.
 */
function RepoConsole({
  profile,
  projectFiles,
}: {
  profile: RepoPreviewProfile;
  projectFiles: ProjectFile[];
}) {
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const isBuilding = useWorkspaceStore((s) => s.isBuilding);
  const [readmeOpen, setReadmeOpen] = useState(false);
  const readme = findReadme(projectFiles);

  function addFrontend() {
    if (isBuilding) return;
    void sendMessage(
      `This repository is a ${profile.framework} ${profile.kind} with no web frontend. ` +
        `Build a modern web frontend for it: read the existing code to understand its ` +
        `data and features, then create a client-side React app (in a frontend/ directory, ` +
        `without touching the existing ${profile.language} code) that presents and interacts ` +
        `with what this project does. Use realistic mock data mirroring the real shapes ` +
        `where a live backend would be required.`,
    );
  }

  if (readmeOpen && readme) {
    return (
      <div className="flex h-full flex-col bg-carbon">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-carbon-line px-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
            README
          </span>
          <button
            onClick={() => setReadmeOpen(false)}
            className="rounded px-2 py-0.5 text-[11.5px] text-dusk-muted transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            Back to overview
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ReadmeViewer content={readme.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="platform-scroll h-full overflow-y-auto bg-carbon">
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        {/* Identity */}
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-carbon-line bg-carbon-raised">
            <Code2 className="size-5 text-brass" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{profile.language}</Badge>
              {profile.framework !== profile.language && <Badge>{profile.framework}</Badge>}
              <Badge tone="muted">{profile.kind}</Badge>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-dusk">
              {profile.summary}
            </p>
          </div>
        </div>

        {/* No-frontend offer */}
        {!profile.hasFrontend && (
          <div className="rounded-xl border border-brass/25 bg-brass/[0.06] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-brass" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-dusk">
                  Seems like your app doesn&apos;t have a frontend
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-dusk-muted">
                  {profile.suggestFrontend
                    ? "Astra can read this codebase and build a web interface for it — pages, views, and interactions on top of what the code already does."
                    : "If you'd like a web interface on top of this code, Astra can build one."}
                </p>
                <button
                  onClick={addFrontend}
                  disabled={isBuilding}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-brass px-3.5 py-1.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
                >
                  {isBuilding ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {isBuilding ? "Astra is building…" : "Add a frontend with Astra"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Compiler / run panel */}
        {profile.runCommands.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised">
            <div className="flex h-8 items-center gap-2 border-b border-carbon-line px-3">
              <Terminal className="size-3.5 text-dusk-faint" />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
                Build &amp; run
              </span>
            </div>
            <div className="space-y-1 p-3 font-mono text-[12px]">
              {profile.runCommands.map((cmd, i) => (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="select-none text-brass">$</span>
                  <span className="break-all text-dusk">{cmd}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entry point + README */}
        <div className="flex flex-wrap items-center gap-2">
          {profile.entryPoint && (
            <span className="flex items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon-raised px-2.5 py-1.5 font-mono text-[11px] text-dusk-muted">
              <FileCode2 className="size-3.5 text-dusk-faint" />
              {profile.entryPoint}
            </span>
          )}
          {readme && (
            <button
              onClick={() => setReadmeOpen(true)}
              className="rounded-lg border border-carbon-line bg-carbon-raised px-2.5 py-1.5 text-[11.5px] text-dusk-muted transition-colors hover:border-brass/40 hover:text-brass"
            >
              View README
            </button>
          )}
        </div>

        <p className="text-[11.5px] leading-relaxed text-dusk-faint">
          This project runs outside the browser, so there&apos;s no live preview —
          Astra still reads and edits every file. Ask it to explain, refactor, or
          extend anything here.
        </p>
      </div>
    </div>
  );
}

function Badge({ children, tone = "brass" }: { children: React.ReactNode; tone?: "brass" | "muted" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        tone === "brass"
          ? "bg-brass/10 text-brass ring-1 ring-inset ring-brass/25"
          : "bg-carbon-high text-dusk-muted",
      )}
    >
      {children}
    </span>
  );
}

/** Find the most likely README file in the project files. */
function findReadme(files: ProjectFile[]): ProjectFile | undefined {
  // Prefer README.md at the root, then any README variant.
  const priority = ["README.md", "readme.md", "README.MD", "Readme.md"];
  for (const name of priority) {
    const found = files.find((f) => f.path === name);
    if (found) return found;
  }
  // Any README at root or one level deep
  return files.find((f) =>
    /^(README|readme|Readme)(\.[a-z]+)?$/i.test(f.path) ||
    /^[^/]+\/(README|readme|Readme)(\.[a-z]+)?$/i.test(f.path),
  );
}

/**
 * Serves a plain static site (HTML/CSS/JS, no framework) with no bundling.
 * Files are re-rooted at the entry HTML's directory so relative asset links
 * (./style.css, ./app.js) resolve, and the entry is served as /index.html.
 */
function StaticRunner({
  projectFiles,
  viewerKey,
  entryHtml,
}: {
  projectFiles: ProjectFile[];
  viewerKey: number;
  entryHtml: string;
}) {
  const files = useMemo(() => {
    const dir = entryHtml.includes("/")
      ? entryHtml.slice(0, entryHtml.lastIndexOf("/") + 1)
      : "";
    const map: Record<string, string> = {};
    for (const f of projectFiles) {
      if (f.path === "package.json") continue;
      // Re-root files under the entry's directory so relative links resolve.
      const rel = dir && f.path.startsWith(dir) ? f.path.slice(dir.length) : f.path;
      map["/" + rel] = f.content;
    }
    // Guarantee the entry is reachable at /index.html.
    const entry = projectFiles.find((f) => f.path === entryHtml);
    if (entry) map["/index.html"] = entry.content;
    return map;
  }, [projectFiles, entryHtml]);

  return (
    <SandpackProvider
      key={viewerKey}
      template="static"
      files={files}
      options={{ recompileMode: "delayed", recompileDelay: 300 }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <PreviewContent packageDeps={{}} />
    </SandpackProvider>
  );
}

/**
 * Shown when GitHub session is missing or expired and files couldn't be loaded.
 * Guides the user to reconnect GitHub rather than showing a confusing blank page.
 */
function RepoLoadFailed() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-carbon px-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-carbon-line bg-carbon-raised">
        <Github className="size-5 text-dusk-faint" />
      </div>
      <div className="max-w-[44ch]">
        <p className="text-[15px] font-medium text-dusk">
          Could not load repository files
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-dusk-muted">
          Your GitHub session may have expired. Reconnect GitHub in Integrations
          and reload to view and edit this repository.
        </p>
      </div>
      <a
        href="/dashboard/integrations"
        className="rounded-lg border border-carbon-line bg-carbon-raised px-4 py-2 text-[12.5px] font-medium text-dusk transition-colors hover:border-brass/40 hover:text-brass"
      >
        Go to Integrations
      </a>
    </div>
  );
}

function SandpackRunner({
  projectFiles,
  viewerKey,
}: {
  projectFiles: ProjectFile[];
  viewerKey: number;
}) {
  const { files, dependencies, entry } = useMemo(() => {
    const fileMap: Record<string, string> = {};
    for (const f of projectFiles) {
      if (f.path === "package.json") continue;
      // index.html is a system shell; the preview supplies its own (below).
      if (f.path === "index.html") continue;
      fileMap["/" + f.path] = f.content;
    }
    // The classic bundler reads its HTML shell from /public/index.html.
    fileMap["/public/index.html"] = buildPreviewShell();

    // Auto-resolve every dependency the project imports, and find its real
    // entry file (projects differ: main.tsx, index.jsx, …).
    const deps = collectDependencies(projectFiles);
    return {
      files: fileMap,
      dependencies: deps,
      entry: detectEntry(projectFiles),
    };
  }, [projectFiles]);

  if (!projectFiles.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-carbon text-[13px] text-dusk-faint">
        <Package className="size-8 text-dusk-faint/40" />
        <span>Nothing to preview yet.</span>
      </div>
    );
  }

  return (
    <SandpackProvider
      key={viewerKey}
      // Classic in-browser bundler — no Node VM boot, dependencies resolved from
      // a CDN. Boots in ~1–3s versus the 5–15s Nodebox-based vite template.
      template="react-ts"
      files={files}
      customSetup={{ dependencies, entry }}
      options={{
        recompileMode: "delayed",
        recompileDelay: 300,
        bundlerTimeOut: 90000,
        // The reliable way to load the Tailwind Play CDN into the preview iframe.
        externalResources: ["https://cdn.tailwindcss.com"],
      }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <PreviewContent packageDeps={dependencies} />
    </SandpackProvider>
  );
}
