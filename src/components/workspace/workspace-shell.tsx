"use client";

/**
 * Workspace shell — the full build surface for one project: chat on the left,
 * and a center that toggles between the Monaco editor, the live preview, or a
 * split of both.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  ArrowLeft,
  Check,
  Code2,
  Columns2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  Github,
  Globe,
  Link2,
  Loader2,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { RenMark } from "@/components/ui/wordmark";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { FileTree } from "@/components/workspace/file-tree";
import { EditorPanel } from "@/components/workspace/editor-panel";
import { LivePreview } from "@/components/workspace/preview";
import { InviteModal } from "@/components/workspace/invite-modal";
import { GitHubPushModal } from "@/components/workspace/github-push-modal";
import { CreditsBadge } from "@/components/workspace/credits-badge";
import { ProfileMenu } from "@/components/workspace/profile-menu";
import { SupabaseConnectModal } from "@/components/workspace/supabase-connect-modal";
import { AgentWorkspace } from "@/components/workspace/agent-workspace";
import { useWorkspaceStore, loadPersisted } from "@/lib/builder/store";
import { downloadProjectZip } from "@/lib/builder/download";
import { createPreviewLink } from "@/lib/actions/preview-links";
import type { ProjectFile, BuildMessage } from "@/lib/builder/types";
import { cn } from "@/lib/utils";

type CenterView = "editor" | "split" | "preview" | "agents";

interface WorkspaceShellProps {
  projectId: string;
  projectName: string;
  projectKind: "new" | "repository";
  repoFullName: string | null;
  repoDefaultBranch: string | null;
  initialFiles: ProjectFile[];
  hadFirstBuild: boolean;
  /** True only when repo files were actually fetched from GitHub (not the fallback template). */
  repoFilesLoaded?: boolean;
  supabaseConnected: boolean;
  supabaseUrl: string | null;
}

export function WorkspaceShell({
  projectId,
  projectName,
  projectKind,
  repoFullName,
  repoDefaultBranch,
  initialFiles,
  hadFirstBuild,
  repoFilesLoaded = false,
  supabaseConnected,
  supabaseUrl,
}: WorkspaceShellProps) {
  const initialize = useWorkspaceStore((s) => s.initialize);
  const projectFiles = useWorkspaceStore((s) => s.projectFiles);
  const viewerKey = useWorkspaceStore((s) => s.viewerKey);
  const [centerView, setCenterView] = useState<CenterView>("preview");
  const [ready, setReady] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMinting, setPreviewMinting] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [supabaseOpen, setSupabaseOpen] = useState(false);

  useEffect(() => {
    const persisted = loadPersisted(projectId);
    // Server files are authoritative once a build has persisted there —
    // localStorage can be STALE (e.g. a background job finished after the last
    // visit) and must never clobber freshly generated files. localStorage still
    // seeds files for never-persisted projects, and always carries the chat.
    const files = hadFirstBuild
      ? initialFiles
      : persisted?.files.length
        ? persisted.files
        : initialFiles;
    const messages: BuildMessage[] = persisted?.messages ?? [];
    const isFirstBuild = !hadFirstBuild && !persisted?.messages?.length;
    initialize(projectId, files, messages, isFirstBuild, projectKind);
    setReady(true);
    // Reattach to a build still running server-side (or pull in one that
    // finished while the user was away) — builds survive leaving the browser.
    void useWorkspaceStore.getState().resumeActiveJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Mint a PUBLIC preview link — a fresh unguessable URL every time — and show
  // it in a panel with Copy/Open. Anyone with the link sees the live app, no
  // account needed: how you show someone the site before it's on the internet.
  async function handleShare() {
    if (previewMinting) return;
    setPreviewMinting(true);
    try {
      const res = await createPreviewLink(projectId);
      if (!res.ok || !res.path) {
        toast.error(res.error ?? "Could not create a preview link.");
        return;
      }
      const url = `${window.location.origin}${res.path}`;
      setPreviewUrl(url);
      navigator.clipboard.writeText(url).catch(() => {});
    } catch {
      toast.error("Could not create a preview link.");
    } finally {
      setPreviewMinting(false);
    }
  }

  function handleDownload() {
    if (!projectFiles.length) {
      toast.error("No files to download yet");
      return;
    }
    downloadProjectZip(projectName, projectFiles);
    toast.success("Downloading project…");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-carbon text-dusk">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-carbon-line px-4">
        {/* Left: back + project name */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-1.5 text-dusk-faint transition-colors hover:text-dusk"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <RenMark className="size-4 shrink-0 text-brass" />
          <span className="shrink-0 font-serif text-[1rem] font-medium tracking-tight text-dusk">
            Ren Labs
          </span>
          {repoFullName && (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-carbon-line px-2 py-0.5 font-mono text-[11px] text-dusk-muted sm:flex">
              <Github className="size-3" />
              {repoFullName}
            </span>
          )}
          {/* Available credits + last-turn token usage */}
          <CreditsBadge />
        </div>

        {/* Center: view toggle */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-carbon-line bg-carbon-raised p-0.5">
          <ViewToggle
            active={centerView === "editor"}
            onClick={() => setCenterView("editor")}
            icon={<Code2 className="size-3.5" />}
            label="Code"
          />
          <ViewToggle
            active={centerView === "split"}
            onClick={() => setCenterView("split")}
            icon={<Columns2 className="size-3.5" />}
            label="Split"
          />
          <ViewToggle
            active={centerView === "preview"}
            onClick={() => setCenterView("preview")}
            icon={<Eye className="size-3.5" />}
            label="Preview"
          />
          <ViewToggle
            active={centerView === "agents"}
            onClick={() => setCenterView("agents")}
            icon={<Users className="size-3.5" />}
            label="Agents"
          />
        </div>

        {/* Right: toolbar actions */}
        <div className="flex shrink-0 items-center gap-1">
          <ToolbarButton
            icon={
              previewMinting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Globe className="size-3.5" />
              )
            }
            label="Preview"
            onClick={handleShare}
          />
          <ToolbarButton
            icon={<Download className="size-3.5" />}
            label="Download"
            onClick={handleDownload}
          />
          <ToolbarButton
            icon={<UserPlus className="size-3.5" />}
            label="Invite"
            onClick={() => setInviteOpen(true)}
          />
          <ToolbarButton
            icon={<Github className="size-3.5" />}
            label="Push"
            onClick={() => {
              if (!projectFiles.length) {
                toast.error("Nothing to push yet — build something first");
                return;
              }
              setPushOpen(true);
            }}
          />
          {/* Circular profile / account menu */}
          <div className="ml-1 pl-1">
            <ProfileMenu />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={30} minSize={22} maxSize={44} className="h-full">
            <ChatPanel projectName={projectName} />
          </Panel>

          <PanelResizeHandle className="w-px bg-carbon-line transition-colors hover:bg-brass/40 data-[resize-handle-active]:bg-brass/60" />

          <Panel defaultSize={70} minSize={40} className="h-full">
            {!ready ? (
              <div className="flex h-full items-center justify-center bg-carbon text-[13px] text-dusk-faint">
                Loading workspace…
              </div>
            ) : centerView === "agents" ? (
              <AgentWorkspace projectId={projectId} projectName={projectName} />
            ) : (
              <div className="flex h-full">
                {centerView !== "preview" && (
                  <div className="flex h-full min-w-0 flex-1">
                    <div className="w-56 shrink-0">
                      <FileTree />
                    </div>
                    <div className="min-w-0 flex-1">
                      <EditorPanel />
                    </div>
                  </div>
                )}
                {centerView !== "editor" && (
                  <div
                    className={cn(
                      "flex h-full flex-col",
                      centerView === "split"
                        ? "w-1/2 border-l border-carbon-line"
                        : "flex-1",
                    )}
                  >
                    {/* Per-project Supabase connection bar */}
                    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-carbon-line px-3">
                      <Database className={cn("size-3.5 shrink-0", supabaseConnected ? "text-signal-green" : "text-dusk-faint")} />
                      {supabaseConnected ? (
                        <>
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-dusk-muted">
                            {supabaseUrl}
                          </span>
                          <button
                            onClick={() => setSupabaseOpen(true)}
                            className="shrink-0 text-[11px] text-dusk-faint transition-colors hover:text-dusk"
                          >
                            Manage
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-[11.5px] text-dusk-faint">
                            No backend connected to this project
                          </span>
                          <button
                            onClick={() => setSupabaseOpen(true)}
                            className="shrink-0 rounded-md border border-brass/30 bg-brass/10 px-2 py-0.5 text-[11px] font-medium text-brass transition-colors hover:bg-brass/20"
                          >
                            Connect backend
                          </button>
                        </>
                      )}
                    </div>
                    <div className="min-h-0 flex-1">
                      <LivePreview
                        projectFiles={projectFiles}
                        viewerKey={viewerKey}
                        projectKind={projectKind}
                        repoFilesLoaded={repoFilesLoaded}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </PanelGroup>
      </div>

      {previewUrl && (
        <PreviewLinkModal
          url={previewUrl}
          projectName={projectName}
          onClose={() => setPreviewUrl(null)}
        />
      )}

      {inviteOpen && (
        <InviteModal
          projectId={projectId}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {pushOpen && (
        <GitHubPushModal
          projectId={projectId}
          projectName={projectName}
          files={projectFiles}
          repoFullName={repoFullName}
          repoDefaultBranch={repoDefaultBranch}
          onClose={() => setPushOpen(false)}
        />
      )}

      {supabaseOpen && (
        <SupabaseConnectModal
          projectId={projectId}
          connected={supabaseConnected}
          projectUrl={supabaseUrl}
          onClose={() => setSupabaseOpen(false)}
        />
      )}
    </div>
  );
}

function ViewToggle({
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
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] transition-colors",
        active ? "bg-carbon-high text-dusk" : "text-dusk-faint hover:text-dusk-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-dusk-faint transition-colors hover:bg-carbon-raised hover:text-dusk"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/**
 * The panel shown after minting a public preview link: the fresh URL with
 * Copy and Open actions. Every mint is a brand-new unguessable link, so the
 * user can hand a different one to each person.
 */
function PreviewLinkModal({
  url,
  projectName,
  onClose,
}: {
  url: string;
  projectName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => toast.error("Could not copy — select the link manually."));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-carbon/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-carbon-line bg-carbon">
              <Globe className="size-4 text-brass" />
            </span>
            <div>
              <p className="text-[14px] font-medium text-dusk">Public preview link</p>
              <p className="text-[11.5px] text-dusk-faint">
                Anyone with this link can view {projectName} — no account needed.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center gap-2 rounded-lg border border-carbon-line bg-carbon px-3 py-2.5">
            <Link2 className="size-3.5 shrink-0 text-dusk-faint" />
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-dusk outline-none"
            />
          </div>
          <p className="text-[11.5px] leading-relaxed text-dusk-faint">
            The link always shows the latest version of your app. Hitting
            Preview again mints a fresh, different link — share a unique one
            with each person.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-carbon-line px-5 py-3.5">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-lg border border-carbon-line px-3 py-1.5 text-[12.5px] text-dusk-muted transition-colors hover:text-dusk"
          >
            {copied ? (
              <Check className="size-3.5 text-signal-green" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-brass px-4 py-1.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep"
          >
            <ExternalLink className="size-3.5" />
            Open preview
          </a>
        </div>
      </div>
    </div>
  );
}
