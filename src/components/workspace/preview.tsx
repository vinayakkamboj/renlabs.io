"use client";

/**
 * Live preview — runs the generated project files in Sandpack.
 * The loading overlay is tied to Sandpack's real bundler state (it clears the
 * moment compilation reports "done"), and a collapsible bottom bar exposes the
 * console output and the installed dependency list.
 */

import { useEffect, useMemo, useState } from "react";
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewPane,
  SandpackConsole,
  useSandpack,
} from "@codesandbox/sandpack-react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Package,
  ScanSearch,
  Terminal,
} from "lucide-react";
import { STANDARD_DEPENDENCIES } from "@/lib/builder/base-template";
import { analyzeWebApp, type WebAppAnalysis } from "@/lib/builder/web-app";
import type { ProjectFile } from "@/lib/builder/types";
import { cn } from "@/lib/utils";

interface PreviewProps {
  projectFiles: ProjectFile[];
  viewerKey: number;
  projectKind?: "new" | "repository";
}

/**
 * Overlay shown while the sandbox boots. It listens to the real Sandpack
 * bundler messages and clears as soon as the app is compiled and running, so
 * the perceived wait is exactly the actual wait — no artificial delay.
 */
function BootOverlay() {
  const { listen } = useSandpack();
  const [done, setDone] = useState(false);
  const [label, setLabel] = useState("Starting sandbox");

  useEffect(() => {
    const stop = listen((msg) => {
      if (msg.type === "start") setLabel("Compiling app");
      if (msg.type === "status" && "status" in msg) {
        const s = (msg as { status?: string }).status;
        if (s === "installing-dependencies") setLabel("Installing packages");
        else if (s === "transpiling") setLabel("Compiling app");
      }
      // "done" fires once the bundle is built and rendered.
      if (msg.type === "done") setDone(true);
    });
    return stop;
  }, [listen]);

  if (done) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-carbon">
      <div className="flex items-center gap-2.5 text-[13px] text-dusk-muted">
        <Loader2 className="size-4 animate-spin text-brass" />
        {label}…
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
        <BootOverlay />
        <SandpackPreviewPane
          showOpenInCodeSandbox={false}
          showRefreshButton={true}
          style={{ height: "100%", width: "100%" }}
        />
      </div>

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
 * live (if it's a previewable web app) or show why a preview isn't available yet.
 */
export function LivePreview({ projectFiles, viewerKey, projectKind }: PreviewProps) {
  if (projectKind === "repository") {
    return <RepoPreviewGate projectFiles={projectFiles} viewerKey={viewerKey} />;
  }
  return <SandpackRunner projectFiles={projectFiles} viewerKey={viewerKey} />;
}

const ANALYSIS_STEPS = [
  "Reading project files",
  "Detecting framework & dependencies",
  "Checking how the project is structured",
  "Deciding how to run it",
];

function RepoPreviewGate({
  projectFiles,
  viewerKey,
}: {
  projectFiles: ProjectFile[];
  viewerKey: number;
}) {
  const analysis = useMemo(() => analyzeWebApp(projectFiles), [projectFiles]);
  const [analyzing, setAnalyzing] = useState(true);
  const [step, setStep] = useState(0);

  // A short, honest analysis pass so the user sees the project being understood
  // before the preview resolves. Steps advance on a timer; the real detection is
  // already computed above.
  useEffect(() => {
    setAnalyzing(true);
    setStep(0);
    const stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 700);
    const doneTimer = setTimeout(() => {
      clearInterval(stepTimer);
      setAnalyzing(false);
    }, 2800);
    return () => {
      clearInterval(stepTimer);
      clearTimeout(doneTimer);
    };
  }, [viewerKey, projectFiles]);

  if (analyzing) {
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

  if (analysis.status !== "previewable") {
    return <UnsupportedNotice analysis={analysis} />;
  }

  return <SandpackRunner projectFiles={projectFiles} viewerKey={viewerKey} />;
}

function UnsupportedNotice({ analysis }: { analysis: WebAppAnalysis }) {
  const nonWeb = analysis.status === "non-web";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-carbon px-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-carbon-line bg-carbon-raised">
        <Package className="size-5 text-dusk-faint" />
      </div>
      <div className="max-w-[44ch]">
        <p className="text-[15px] font-medium text-dusk">
          {nonWeb
            ? "Preview isn't available for this project"
            : `Live preview for ${analysis.framework} is coming soon`}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-dusk-muted">
          {analysis.detail}
        </p>
      </div>
      <span className="rounded-full border border-carbon-line bg-carbon-raised px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-dusk-faint">
        Web apps supported today
      </span>
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
  const { files, dependencies, packageDeps } = useMemo(() => {
    const fileMap: Record<string, string> = {};
    let pkgDeps: Record<string, string> = { ...STANDARD_DEPENDENCIES };

    for (const f of projectFiles) {
      if (f.path === "package.json") {
        try {
          const parsed = JSON.parse(f.content) as {
            dependencies?: Record<string, string>;
          };
          pkgDeps = { ...pkgDeps, ...(parsed.dependencies ?? {}) };
        } catch {
          /* keep standard deps */
        }
        continue;
      }
      // index.html is a system shell; the preview supplies its own (below).
      if (f.path === "index.html") continue;
      fileMap["/" + f.path] = f.content;
    }

    // The classic bundler reads its HTML shell from /public/index.html.
    fileMap["/public/index.html"] = buildPreviewShell();

    return { files: fileMap, dependencies: pkgDeps, packageDeps: pkgDeps };
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
      customSetup={{ dependencies, entry: "/src/main.tsx" }}
      options={{
        recompileMode: "delayed",
        recompileDelay: 300,
        bundlerTimeOut: 90000,
        // The reliable way to load the Tailwind Play CDN into the preview iframe.
        externalResources: ["https://cdn.tailwindcss.com"],
      }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <PreviewContent packageDeps={packageDeps} />
    </SandpackProvider>
  );
}
