"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Github,
  Loader2,
  Lock,
  Plug,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectFile } from "@/lib/builder/types";

interface GitHubPushModalProps {
  projectName: string;
  files: ProjectFile[];
  repoFullName: string | null;
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

function timestampedName(base: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return slugify(`${base}-${stamp}`);
}

export function GitHubPushModal({
  projectName,
  files,
  repoFullName,
  onClose,
}: GitHubPushModalProps) {
  const pathname = usePathname();
  const baseName = useMemo(
    () => slugify(repoFullName?.split("/")[1] ?? projectName),
    [repoFullName, projectName],
  );

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [repo, setRepo] = useState(() => timestampedName(baseName));
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState("Initial commit from Ren Code");
  const [privateRepo, setPrivateRepo] = useState(true);
  const [reuseExisting, setReuseExisting] = useState(Boolean(repoFullName));
  const [token, setToken] = useState("");
  const [showTokenFallback, setShowTokenFallback] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [result, setResult] = useState<PushSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingStatus(true);
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
      setStatus((s) =>
        s ? { ...s, connected: false, login: null, scopes: [] } : s,
      );
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
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          branch,
          message,
          privateRepo,
          reuseExisting,
          // token fallback for local dev / expired OAuth
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
      setResult(data as PushSuccess);
      setRepo(timestampedName(baseName)); // fresh name for next push
      toast.success(`Pushed to ${(data as PushSuccess).repoFullName}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPushing(false);
    }
  }

  const hasAuth = Boolean(status?.connected || token.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-carbon/80 backdrop-blur-sm"
        onClick={() => !pushing && onClose()}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Github className="size-4 text-brass" />
            <div>
              <p className="text-[14px] font-medium text-dusk">
                Push to GitHub
              </p>
              <p className="text-[11.5px] text-dusk-faint">
                Creates a new repo and commits all project files
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
                <p className="text-[11.5px] text-amber-300/80">
                  Reconnect to push.
                </p>
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
                <div>
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-dusk">
                    <CheckCircle2 className="size-3.5 text-brass" />
                    Connected as{" "}
                    <span className="font-mono">@{status.login}</span>
                  </div>
                  {status.scopes.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-dusk-faint">
                      Scopes: {status.scopes.join(", ")}
                    </p>
                  )}
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
                <div>
                  <p className="text-[12.5px] font-medium text-dusk">
                    Not connected
                  </p>
                  <p className="text-[11px] text-dusk-faint">
                    Token stored in an encrypted httpOnly cookie.
                  </p>
                </div>
                <button
                  onClick={connectGitHub}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-[12px] font-medium text-carbon transition-colors hover:bg-brass-deep"
                >
                  <Plug className="size-3.5" />
                  Connect
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[12.5px] font-medium text-amber-200">
                  GitHub not configured
                </p>
                <p className="mt-1 text-[11px] text-dusk-faint">
                  Set{" "}
                  <code className="font-mono text-brass">GITHUB_CLIENT_ID</code>{" "}
                  and{" "}
                  <code className="font-mono text-brass">
                    GITHUB_CLIENT_SECRET
                  </code>{" "}
                  in your environment.
                </p>
              </div>
            )}
          </div>

          {/* Success */}
          {result && (
            <div className="rounded-lg border border-brass/20 bg-brass/10 p-3">
              <p className="text-[13px] font-medium text-dusk">
                Pushed {result.fileCount} files to{" "}
                <span className="text-brass">{result.repoFullName}</span>
              </p>
              <div className="mt-2 flex gap-2">
                <a
                  href={result.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[12px] text-dusk-muted transition-colors hover:text-dusk"
                >
                  Repository <ExternalLink className="size-3" />
                </a>
                <span className="text-dusk-faint">·</span>
                <a
                  href={result.commitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[12px] text-dusk-muted transition-colors hover:text-dusk"
                >
                  Commit <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          )}

          {/* Push form */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repository name" className="col-span-2">
              <input
                value={repo}
                onChange={(e) => setRepo(slugify(e.target.value))}
                placeholder="my-app"
                className="w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong font-mono"
              />
            </Field>
            <Field label="Branch">
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
              />
            </Field>
            <Field label="Visibility">
              <button
                type="button"
                onClick={() => setPrivateRepo((v) => !v)}
                className="w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong flex w-full items-center justify-between"
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
                className="w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[12px] text-dusk-muted">
            <input
              type="checkbox"
              checked={reuseExisting}
              onChange={(e) => setReuseExisting(e.target.checked)}
              className="size-3.5 accent-brass"
            />
            Push into existing repo of this name (otherwise creates a new one)
          </label>

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
                    className="w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong font-mono"
                  />
                </Field>
                <p className="mt-2 text-[11px] text-dusk-faint">
                  Not saved. Useful for local testing or when OAuth isn&apos;t
                  available.
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-[12px] text-signal-red">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-carbon-line px-5 py-3.5">
          <button
            onClick={() => !pushing && onClose()}
            disabled={pushing}
            className="rounded-lg border border-carbon-line px-3 py-1.5 text-[12.5px] text-dusk-faint transition-colors hover:text-dusk disabled:opacity-50"
          >
            Close
          </button>
          <button
            onClick={handlePush}
            disabled={pushing || !repo.trim() || !hasAuth || !files.length}
            className="flex items-center gap-1.5 rounded-lg bg-brass px-4 py-1.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
          >
            {pushing && <Loader2 className="size-3.5 animate-spin" />}
            {pushing
              ? "Creating repo…"
              : `Push ${files.length} file${files.length !== 1 ? "s" : ""}`}
          </button>
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
