"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Github,
  Loader2,
  Lock,
  X,
} from "lucide-react";
import type { ProjectFile } from "@/lib/builder/types";

interface GitHubPushModalProps {
  projectName: string;
  files: ProjectFile[];
  /** repo "owner/name" if this project is already linked to one */
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

export function GitHubPushModal({
  projectName,
  files,
  repoFullName,
  onClose,
}: GitHubPushModalProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const linkedName = repoFullName?.split("/")[1] ?? null;
  const [repo, setRepo] = useState(slugify(linkedName ?? projectName));
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState("Initial commit from Ren Code");
  const [privateRepo, setPrivateRepo] = useState(true);
  const [reuseExisting, setReuseExisting] = useState(Boolean(repoFullName));
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PushSuccess | null>(null);

  useEffect(() => {
    fetch("/api/github/status")
      .then((r) => r.json())
      .then((d: StatusResponse) => setStatus(d))
      .catch(() => setStatus({ configured: false, connected: false, login: null, scopes: [] }));
  }, []);

  async function handlePush() {
    setError(null);
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
          files,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Push failed.");
        return;
      }
      setResult(data as PushSuccess);
    } catch {
      setError("Network error while pushing. Try again.");
    } finally {
      setPushing(false);
    }
  }

  const connectUrl = `/api/github/connect?returnTo=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.pathname : "/dashboard",
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-carbon/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Github className="size-4 text-brass" />
            <span className="text-[14px] font-medium text-dusk">Push to GitHub</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Loading status */}
          {status === null && (
            <div className="flex items-center gap-2 py-6 text-[13px] text-dusk-faint">
              <Loader2 className="size-4 animate-spin" />
              Checking GitHub connection…
            </div>
          )}

          {/* Not configured */}
          {status && !status.configured && (
            <p className="py-4 text-[13px] text-dusk-muted">
              GitHub isn&apos;t configured on this deployment. Set{" "}
              <code className="rounded bg-carbon px-1 py-0.5 font-mono text-[12px] text-brass">
                GITHUB_CLIENT_ID
              </code>{" "}
              and{" "}
              <code className="rounded bg-carbon px-1 py-0.5 font-mono text-[12px] text-brass">
                GITHUB_CLIENT_SECRET
              </code>{" "}
              to enable pushing.
            </p>
          )}

          {/* Configured but not connected */}
          {status && status.configured && !status.connected && (
            <div className="py-2">
              <p className="text-[13px] text-dusk-muted">
                Connect your GitHub account to create the repo and push your
                project. Ren only ever touches repositories in the account you
                authorize.
              </p>
              <a
                href={connectUrl}
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brass px-4 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep"
              >
                <Github className="size-4" />
                Connect GitHub
              </a>
            </div>
          )}

          {/* Success */}
          {result && (
            <div className="py-2">
              <div className="flex items-center gap-2 text-[14px] font-medium text-dusk">
                <CheckCircle2 className="size-4 text-brass" />
                Pushed to {result.repoFullName}
              </div>
              <p className="mt-1 text-[12.5px] text-dusk-muted">
                {result.fileCount} files committed to{" "}
                <span className="font-mono text-dusk">{result.branch}</span>.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={result.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk transition-colors hover:border-carbon-line-strong"
                >
                  <span className="flex items-center gap-2">
                    <Github className="size-3.5 text-dusk-faint" />
                    Open repository
                  </span>
                  <ExternalLink className="size-3.5 text-dusk-faint" />
                </a>
                <a
                  href={result.commitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk transition-colors hover:border-carbon-line-strong"
                >
                  <span>View commit</span>
                  <ExternalLink className="size-3.5 text-dusk-faint" />
                </a>
              </div>
            </div>
          )}

          {/* Connected — push form */}
          {status && status.configured && status.connected && !result && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-1.5 text-[12px] text-dusk-faint">
                <CheckCircle2 className="size-3.5 text-brass" />
                Connected as{" "}
                <span className="font-mono text-dusk-muted">@{status.login}</span>
              </div>

              <Field label="Repository name">
                <input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="my-app"
                  className="w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 font-mono text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
                />
              </Field>

              <div className="flex gap-3">
                <Field label="Branch" className="flex-1">
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 font-mono text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
                  />
                </Field>
                <Field label="Visibility" className="flex-1">
                  <button
                    type="button"
                    onClick={() => setPrivateRepo((v) => !v)}
                    className="flex w-full items-center justify-between rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk transition-colors hover:border-carbon-line-strong"
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
              </div>

              <Field label="Commit message">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
                />
              </Field>

              <label className="flex items-center gap-2 text-[12.5px] text-dusk-muted">
                <input
                  type="checkbox"
                  checked={reuseExisting}
                  onChange={(e) => setReuseExisting(e.target.checked)}
                  className="size-3.5 accent-brass"
                />
                Push into an existing repo of this name (otherwise a fresh repo
                is created)
              </label>

              {error && <p className="text-[12px] text-signal-red">{error}</p>}

              <button
                onClick={handlePush}
                disabled={pushing || !repo.trim()}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brass px-4 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
              >
                {pushing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Pushing…
                  </>
                ) : (
                  <>
                    <Github className="size-4" />
                    Push {files.length} files
                  </>
                )}
              </button>
            </div>
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
    <div className={className}>
      <label className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wide text-dusk-faint">
        {label}
      </label>
      {children}
    </div>
  );
}
