"use client";

/**
 * Full-screen public renderer for a shared preview link: a slim header with
 * the project name + Ren attribution, and the live app filling the rest of
 * the viewport. Reuses the workspace's Sandpack preview pipeline unchanged.
 */

import { LivePreview } from "@/components/workspace/preview";
import { RenMark } from "@/components/ui/wordmark";
import type { ProjectFile } from "@/lib/builder/types";

export function PublicPreviewViewer({
  projectName,
  files,
}: {
  projectName: string;
  files: ProjectFile[];
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-carbon text-dusk">
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-carbon-line px-4">
        <span className="truncate text-[13px] font-medium text-dusk">
          {projectName}
        </span>
        <span className="shrink-0 rounded-full border border-carbon-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-dusk-faint">
          Live preview
        </span>
        <a
          href="https://renlabs.io"
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex shrink-0 items-center gap-1.5 text-[11.5px] text-dusk-faint transition-colors hover:text-dusk"
        >
          <RenMark className="size-3.5 text-brass" />
          Built with Ren
        </a>
      </header>
      <div className="min-h-0 flex-1">
        <LivePreview projectFiles={files} viewerKey={0} projectKind="new" />
      </div>
    </div>
  );
}
