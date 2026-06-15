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
import { ChevronDown, ChevronUp, Loader2, Package, Terminal } from "lucide-react";
import { STANDARD_DEPENDENCIES } from "@/lib/builder/base-template";
import type { ProjectFile } from "@/lib/builder/types";
import { cn } from "@/lib/utils";

interface PreviewProps {
  projectFiles: ProjectFile[];
  viewerKey: number;
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
 * The classic in-browser bundler injects its own entry bundle into the page,
 * so any `<script type="module">` the template ships (which points at the Vite
 * entry) must be removed to avoid mounting the app twice. Everything else in the
 * HTML — crucially the Tailwind Play CDN tag and its inline config — is kept.
 */
function toPreviewHtml(raw: string | undefined): string {
  const html = raw ?? FALLBACK_PREVIEW_HTML;
  return html.replace(/<script\b[^>]*\btype=["']module["'][^>]*>\s*<\/script>\s*/gi, "");
}

const FALLBACK_PREVIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

export function LivePreview({ projectFiles, viewerKey }: PreviewProps) {
  const { files, dependencies, packageDeps } = useMemo(() => {
    const fileMap: Record<string, string> = {};
    let pkgDeps: Record<string, string> = { ...STANDARD_DEPENDENCIES };
    let html: string | undefined;

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
      if (f.path === "index.html") {
        html = f.content;
        continue;
      }
      fileMap["/" + f.path] = f.content;
    }

    // The classic bundler reads its HTML shell from /public/index.html.
    fileMap["/public/index.html"] = toPreviewHtml(html);

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
      }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <PreviewContent packageDeps={packageDeps} />
    </SandpackProvider>
  );
}
