"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  Github,
  Loader2,
  Lock,
  Search,
  Star,
  X,
} from "lucide-react";
import { importFromGitHub } from "@/lib/actions/projects";

interface GitHubStatus {
  configured: boolean;
  connected: boolean;
  login: string | null;
}

interface GitHubRepo {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
  stargazersCount: number;
}

export function GitHubImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-3 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk"
      >
        <Github className="size-3.5" />
        Import from GitHub
      </button>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [query, setQuery] = useState("");
  const [importing, startImport] = useTransition();
  const [importingId, setImportingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/github/status")
      .then((r) => r.json())
      .then((d: GitHubStatus) => setStatus(d))
      .catch(() =>
        setStatus({ configured: false, connected: false, login: null }),
      );
  }, []);

  useEffect(() => {
    if (!status?.connected) return;
    fetch("/api/github/repositories")
      .then((r) => r.json())
      .then((d: { repositories: GitHubRepo[] }) =>
        setRepos(d.repositories ?? []),
      )
      .catch(() => setRepos([]));
  }, [status?.connected]);

  const filtered = repos?.filter((r) =>
    r.fullName.toLowerCase().includes(query.toLowerCase()),
  );

  function handleImport(repo: GitHubRepo) {
    if (importing) return;
    setImportingId(repo.id);
    startImport(async () => {
      await importFromGitHub({
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.private,
        language: repo.language,
      });
    });
  }

  const connectUrl = `/api/github/connect?returnTo=${encodeURIComponent("/dashboard")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-carbon/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-carbon-line bg-carbon-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Github className="size-4 text-brass" />
            <span className="text-[14px] font-medium text-dusk">
              Import from GitHub
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5">
          {/* Loading status */}
          {status === null && (
            <div className="flex items-center gap-2 py-4 text-[13px] text-dusk-faint">
              <Loader2 className="size-4 animate-spin" />
              Checking GitHub connection…
            </div>
          )}

          {/* Not configured */}
          {status && !status.configured && (
            <p className="py-2 text-[13px] text-dusk-muted">
              GitHub isn&apos;t configured on this deployment. Set{" "}
              <code className="rounded bg-carbon px-1 font-mono text-[12px] text-brass">
                GITHUB_CLIENT_ID
              </code>{" "}
              and{" "}
              <code className="rounded bg-carbon px-1 font-mono text-[12px] text-brass">
                GITHUB_CLIENT_SECRET
              </code>
              .
            </p>
          )}

          {/* Not connected */}
          {status && status.configured && !status.connected && (
            <div>
              <p className="text-[13px] text-dusk-muted">
                Connect your GitHub account and choose which repositories Ren can
                access. You pick the repos during install — Ren only ever sees the
                ones you select.
              </p>
              <a
                href={connectUrl}
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brass px-4 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep"
              >
                <Github className="size-4" />
                Connect GitHub & choose repos
              </a>
            </div>
          )}

          {/* Connected */}
          {status && status.connected && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] text-dusk-faint">
                  <CheckCircle2 className="size-3.5 text-brass" />
                  <span className="font-mono text-dusk-muted">
                    @{status.login}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="https://github.com/settings/installations"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11.5px] text-dusk-faint transition-colors hover:text-dusk"
                  >
                    Manage repos
                  </a>
                  <a
                    href={connectUrl}
                    className="text-[11.5px] text-dusk-faint transition-colors hover:text-dusk"
                  >
                    Switch account
                  </a>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-dusk-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search repositories…"
                  className="w-full rounded-lg border border-carbon-line bg-carbon py-2.5 pl-9 pr-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
                />
              </div>

              {/* Repo list */}
              <div className="max-h-72 overflow-y-auto rounded-lg border border-carbon-line">
                {repos === null ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-dusk-faint">
                    <Loader2 className="size-4 animate-spin" />
                    Loading repositories…
                  </div>
                ) : filtered?.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-dusk-faint">
                    No repositories found
                  </p>
                ) : (
                  <ul>
                    {filtered?.map((repo, i) => (
                      <li
                        key={repo.id}
                        className={`border-carbon-line ${i !== 0 ? "border-t" : ""}`}
                      >
                        <button
                          onClick={() => handleImport(repo)}
                          disabled={importing}
                          className="flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-carbon-high/50 disabled:opacity-50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-medium text-dusk">
                                {repo.fullName.split("/")[1]}
                              </span>
                              {repo.private && (
                                <Lock className="size-3 shrink-0 text-dusk-faint" />
                              )}
                            </div>
                            <p className="text-[11px] text-dusk-faint">
                              {repo.fullName.split("/")[0]}
                            </p>
                            {repo.description && (
                              <p className="mt-1 line-clamp-1 text-[12px] text-dusk-muted">
                                {repo.description}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-dusk-faint/60">
                              {repo.language && <span>{repo.language}</span>}
                              {repo.stargazersCount > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <Star className="size-2.5" />
                                  {repo.stargazersCount}
                                </span>
                              )}
                            </div>
                          </div>
                          {importingId === repo.id && importing ? (
                            <Loader2 className="size-4 shrink-0 animate-spin text-brass" />
                          ) : (
                            <span className="shrink-0 rounded-md border border-carbon-line bg-carbon px-2.5 py-1 text-[11.5px] text-dusk-muted transition-colors group-hover:border-carbon-line-strong">
                              Import
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-carbon-line px-5 py-3.5">
          <p className="text-[11.5px] text-dusk-faint">
            Ren only accesses repositories in the account you authorized. Files
            are loaded on-demand — nothing is copied until you open the
            workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
