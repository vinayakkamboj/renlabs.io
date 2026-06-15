"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Github,
  Loader2,
  Lock,
  Plug,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { linkProjectToRepo } from "@/lib/actions/projects";
import type { ProjectFile } from "@/lib/builder/types";

interface GitHubPushModalProps {
  projectId: string;
  projectName: string;
  files: ProjectFile[];
  /** "owner/name" when this project is already linked to a repository. */
  repoFullName: string | null;
  repoDefaultBranch: string | null;
  onClose: () => void;
}

interface StatusResponse {
  configured: boolean;
  connected: boolean;
  login: string | null;
  scopes: string[];
}

interface PushSuccess {
  repoFullName: string;
  repoUrl: string;
  branch: string;
  commitUrl: string;
  fileCount: number;
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "ren-app"
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong";

export function GitHubPushModal({
  projectId,
  projectName,
  files,
  repoFullName,
  repoDefaultBranch,
  onClose,
}: GitHubPushModalProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Two modes, decided by whether the project is already tied to a repo.
  const linked = Boolean(repoFullName);
  const linkedOwner = repoFullName?.split("/")[0] ?? null;
  const linkedRepo = repoFullName?.split("/")[1] ?? null;

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const [repoName, setRepoName] = useState(() => slugify(projectName));
  const [branch, setBranch] = useState(repoDefaultBranch || "main");
  const [message, setMessage] = useState(
    linked ? "Update from Ren Code" : "Initial commit from Ren Code",
  );
  const [privateRepo, setPrivateRepo] = useState(true);
  const [token, setToken] = useState("");
  const [showTokenFallback, setShowTokenFallback] = useState(false);

  const [pushing, setPushing] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [result, setResult] = useState<PushSuccess | null>(null);
  const [linkedNow, setLinkedNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load connection status once.
  useEffect(() => {
    fetch("/api/github/status")
      .then((r) => r.json())
      .then((d: StatusResponse) => setStatus(d))
      .catch(() =>
        setStatus({ configured: false, connected: false, login: null, scopes: [] }),
      )
      .finally(() => setLoadingStatus(false));
  }, []);

  const connectUrl = `/api/github/connect?returnTo=${encodeURIComponent(
    `${pathname || "/"}?githubPush=1`,
  )}`;

  function connectGitHub() {
    window.location.href = connectUrl;
  }

  async function disconnectGitHub() {
    setDisconnecting(true);
    try {
      await fetch("/api/github/disconnect", { method: "POST" });
      setStatus((s) => (s ? { ...s, connected: false, login: null, scopes: [] } : s));
      toast.success("GitHub disconnected");
    } catch {
      toast.error("Could not disconnect GitHub");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handlePush() {
    setError(null);
    setNeedsReauth(false);
    setPushing(true);
    try {
      // Linked → commit to that exact repo. New → create a fresh repo.
      const payload = linked
        ? {
            owner: linkedOwner,
            repo: linkedRepo,
            branch,
            message,
            reuseExisting: true,
          }
        : {
            repo: repoName,
            branch,
            message,
            privateRepo,
            reuseExisting: false,
          };

      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(token.trim() ? { token: token.trim() } : {}),
          files,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.reauthRequired || res.status === 401) {
          setNeedsReauth(true);
          setStatus((s) => (s ? { ...s, connected: false, login: null } : s));
          toast.error("GitHub session expired. Reconnect to push.");
          return;
        }
        setError(data?.error ?? "Push failed.");
        return;
      }

      const success = data as PushSuccess;
      setResult(success);
      toast.success(`Pushed to ${success.repoFullName}`);

      // New project: remember the repo we just made so the NEXT push updates it
      // instead of spawning another repo.
      if (!linked) {
        const ok = await linkProjectToRepo(projectId, {
          fullName: success.repoFullName,
          defaultBranch: success.branch,
          isPrivate: privateRepo,
        });
        if (ok.ok) {
          setLinkedNow(true);
          router.refresh();
        }
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPushing(false);
    }
  }

  const hasAuth = Boolean(status?.connected || token.trim());
  const canPush =
    !pushing && hasAuth && files.length > 0 && (linked || repoName.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-carbon/80 backdrop-blur-sm"
        onClick={() => !pushing && onClose()}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-carbon-line bg-carbon">
              <Github className="size-4 text-brass" />
            </span>
            <div>
              <p className="text-[14px] font-medium text-dusk">
                {linked ? "Push to repository" : "Publish to GitHub"}
              </p>
              <p className="text-[11.5px] text-dusk-faint">
                {linked
                  ? `Commits your changes to ${repoFullName}`
                  : "Creates a new repository and commits all files"}
              </p>
            </div>
          </div>
          <button
            onClick={() => !pushing && onClose()}
            className="rounded-lg p-1 text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Session expired warning */}
          {needsReauth && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div>
                <p className="text-[12.5px] font-medium text-amber-200">
                  GitHub session expired
                </p>
                <p className="text-[11.5px] text-amber-300/80">Reconnect to push.</p>
              </div>
              <button
                onClick={connectGitHub}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-200 px-3 py-1.5 text-[12px] font-medium text-amber-900"
              >
                <Plug className="size-3.5" />
                Reconnect
              </button>
            </div>
          )}

          {/* Connection status */}
          <div className="rounded-lg border border-carbon-line bg-carbon p-3">
            {loadingStatus ? (
              <div className="flex items-center gap-2 text-[12.5px] text-dusk-faint">
                <Loader2 className="size-3.5 animate-spin" />
                Checking connection…
              </div>
            ) : status?.connected ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-dusk">
                  <CheckCircle2 className="size-3.5 text-brass" />
                  Connected as <span className="font-mono">@{status.login}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={connectGitHub}
                    className="rounded-md border border-carbon-line px-2 py-1 text-[11px] text-dusk-faint transition-colors hover:text-dusk"
                  >
                    Switch
                  </button>
                  <button
                    onClick={disconnectGitHub}
                    disabled={disconnecting}
                    className="rounded-md border border-carbon-line px-2 py-1 text-[11px] text-dusk-faint transition-colors hover:text-dusk disabled:opacity-50"
                  >
                    {disconnecting ? "…" : "Disconnect"}
                  </button>
                </div>
              </div>
            ) : status?.configured ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-medium text-dusk">Not connected</p>
                <button
                  onClick={connectGitHub}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-[12px] font-medium text-carbon transition-colors hover:bg-brass-deep"
                >
                  <Plug className="size-3.5" />
                  Connect
                </button>
              </div>
            ) : (
              <p className="text-[12px] text-dusk-faint">
                GitHub isn&apos;t configured on this deployment.
              </p>
            )}
          </div>

          {/* Success */}
          {result ? (
            <div className="rounded-lg border border-brass/20 bg-brass/10 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-medium text-dusk">
                <CheckCircle2 className="size-4 text-brass" />
                Pushed {result.fileCount} files to {result.repoFullName}
              </p>
              <div className="mt-2 flex gap-3">
                <a
                  href={result.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[12px] text-dusk-muted transition-colors hover:text-dusk"
                >
                  Repository <ExternalLink className="size-3" />
                </a>
                <a
                  href={result.commitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[12px] text-dusk-muted transition-colors hover:text-dusk"
                >
                  Commit <ExternalLink className="size-3" />
                </a>
              </div>
              {linkedNow && (
                <p className="mt-2 border-t border-brass/15 pt-2 text-[11.5px] text-dusk-faint">
                  This project is now linked to the repo — future pushes will
                  update it.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* ── Linked mode: fixed repo, just branch + message ── */}
              {linked ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-carbon-line bg-carbon px-3 py-2.5">
                    <Github className="size-4 shrink-0 text-dusk-faint" />
                    <span className="truncate font-mono text-[13px] text-dusk">
                      {repoFullName}
                    </span>
                    <span className="ml-auto rounded-full bg-carbon-high px-2 py-0.5 text-[10.5px] text-dusk-muted">
                      linked
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Branch">
                      <div className="relative">
                        <GitBranch className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-dusk-faint" />
                        <input
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className={`${INPUT_CLASS} pl-9`}
                        />
                      </div>
                    </Field>
                    <Field label="Commit message">
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                /* ── New mode: name, branch, visibility, message ── */
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Repository name" className="col-span-2">
                    <input
                      value={repoName}
                      onChange={(e) => setRepoName(slugify(e.target.value))}
                      placeholder="my-app"
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </Field>
                  <Field label="Branch">
                    <input
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Visibility">
                    <button
                      type="button"
                      onClick={() => setPrivateRepo((v) => !v)}
                      className={`${INPUT_CLASS} flex items-center justify-between`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Lock className="size-3.5 text-dusk-faint" />
                        {privateRepo ? "Private" : "Public"}
                      </span>
                      <span
                        className={`h-4 w-7 rounded-full p-0.5 transition-colors ${
                          privateRepo ? "bg-brass" : "bg-carbon-high"
                        }`}
                      >
                        <span
                          className={`block size-3 rounded-full bg-carbon transition-transform ${
                            privateRepo ? "translate-x-3" : ""
                          }`}
                        />
                      </span>
                    </button>
                  </Field>
                  <Field label="Commit message" className="col-span-2">
                    <input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>
              )}

              {/* PAT fallback */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTokenFallback((v) => !v)}
                  className="text-[11.5px] text-dusk-faint transition-colors hover:text-dusk"
                >
                  {showTokenFallback
                    ? "Hide token fallback"
                    : "Use a personal access token instead"}
                </button>
                {showTokenFallback && (
                  <div className="mt-2 rounded-lg border border-carbon-line bg-carbon p-3">
                    <Field label="GitHub fine-grained PAT">
                      <input
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        type="password"
                        placeholder="github_pat_…"
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </Field>
                  </div>
                )}
              </div>

              {error && <p className="text-[12px] text-signal-red">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-carbon-line px-5 py-3.5">
          <button
            onClick={() => !pushing && onClose()}
            disabled={pushing}
            className="rounded-lg border border-carbon-line px-3 py-1.5 text-[12.5px] text-dusk-faint transition-colors hover:text-dusk disabled:opacity-50"
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handlePush}
              disabled={!canPush}
              className="flex items-center gap-1.5 rounded-lg bg-brass px-4 py-1.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
            >
              {pushing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUpFromLine className="size-3.5" />
              )}
              {pushing
                ? linked
                  ? "Pushing…"
                  : "Creating repo…"
                : linked
                  ? `Push to ${linkedRepo}`
                  : "Create repo & push"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-dusk-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
