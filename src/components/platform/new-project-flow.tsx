"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Github,
  Loader2,
  Lock,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { newProjectExamples } from "@/lib/data/code";
import { createProject, importFromGitHub } from "@/lib/actions/projects";
import { cn } from "@/lib/utils";

type Mode = "new" | "repository";

interface NewProjectFlowProps {
  githubConnected: boolean;
  initialMode?: Mode;
}

interface LiveRepo {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
}

export function NewProjectFlow({
  githubConnected,
  initialMode = "new",
}: NewProjectFlowProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitNew() {
    setError(null);
    const finalName = name.trim() || deriveName(prompt);
    if (!finalName) {
      setError("Give the project a name or describe what to build.");
      return;
    }
    startTransition(async () => {
      try {
        await createProject({
          name: finalName,
          kind: "new",
          prompt: prompt.trim() || undefined,
          description: prompt.trim() ? truncate(prompt.trim(), 160) : undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create project.");
      }
    });
  }

  return (
    <div className="max-w-3xl">
      {/* Two clear starting points */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            {
              id: "new" as Mode,
              icon: Sparkles,
              label: "Start blank",
              sub: "No repository — Astra builds from a prompt, and you can publish a new repo later",
            },
            {
              id: "repository" as Mode,
              icon: Github,
              label: "Start from a repository",
              sub: "Pull one of your GitHub repos into the workspace and build on it",
            },
          ]
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              setError(null);
            }}
            className={cn(
              "flex flex-col items-start rounded-xl border p-5 text-left transition-colors duration-200",
              mode === m.id
                ? "border-brass bg-carbon-high"
                : "border-carbon-line bg-carbon-raised hover:border-carbon-line-strong",
            )}
          >
            <m.icon
              className={cn("size-5", mode === m.id ? "text-brass" : "text-dusk-faint")}
            />
            <span className="mt-4 text-[14px] font-medium text-dusk">{m.label}</span>
            <span className="mt-1 text-[12.5px] leading-relaxed text-dusk-muted">
              {m.sub}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-signal-red/10 px-3 py-2 text-[12.5px] text-signal-red">
          {error}
        </p>
      ) : null}

      {mode === "new" ? (
        <div className="mt-6 rounded-xl border border-carbon-line bg-carbon-raised p-5">
          <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dusk-faint">
            Project name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Atlas CRM"
            className="mt-2 w-full rounded-lg border border-carbon-line bg-carbon px-4 py-2.5 text-[14px] text-dusk outline-none transition-colors placeholder:text-dusk-faint focus:border-carbon-line-strong"
          />

          <label className="mt-5 block font-mono text-[10.5px] uppercase tracking-[0.14em] text-dusk-faint">
            Describe what you want to build
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="A multi-tenant SaaS with authentication, billing, and a usage dashboard…"
            className="platform-scroll mt-2 w-full resize-none rounded-lg border border-carbon-line bg-carbon px-4 py-3 text-[14px] text-dusk outline-none transition-colors placeholder:text-dusk-faint focus:border-carbon-line-strong"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {newProjectExamples.map((ex) => (
              <button
                key={ex.prompt}
                onClick={() => setPrompt(ex.detail)}
                className="rounded-full border border-carbon-line bg-carbon px-3 py-1.5 text-[12px] text-dusk-muted transition-colors duration-200 hover:border-carbon-line-strong hover:text-dusk"
              >
                {ex.prompt}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-carbon-line pt-4">
            <p className="text-[12px] text-dusk-faint">
              You can publish this to a brand-new GitHub repository anytime from
              the workspace.
            </p>
            <button
              onClick={submitNew}
              disabled={pending || (!name.trim() && !prompt.trim())}
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brass px-5 text-[13px] font-medium text-carbon transition-colors duration-200 hover:bg-brass-deep disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
              Create project
            </button>
          </div>
        </div>
      ) : (
        <RepositoryPicker
          githubConnected={githubConnected}
          pending={pending}
          onImport={(repo) => {
            setError(null);
            startTransition(async () => {
              try {
                await importFromGitHub({
                  fullName: repo.fullName,
                  defaultBranch: repo.defaultBranch,
                  isPrivate: repo.private,
                  language: repo.language,
                });
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not import repository.",
                );
              }
            });
          }}
        />
      )}
    </div>
  );
}

function RepositoryPicker({
  githubConnected,
  pending,
  onImport,
}: {
  githubConnected: boolean;
  pending: boolean;
  onImport: (repo: LiveRepo) => void;
}) {
  const [repos, setRepos] = useState<LiveRepo[] | null>(null);
  const [query, setQuery] = useState("");
  const [importingId, setImportingId] = useState<number | null>(null);

  useEffect(() => {
    if (!githubConnected) return;
    fetch("/api/github/repositories")
      .then((r) => r.json())
      .then((d: { repositories?: LiveRepo[] }) => setRepos(d.repositories ?? []))
      .catch(() => setRepos([]));
  }, [githubConnected]);

  if (!githubConnected) {
    return (
      <div className="mt-6 rounded-xl border border-carbon-line bg-carbon-raised p-5">
        <p className="text-[14px] leading-relaxed text-dusk">
          Connect your GitHub account to build on an existing repository. Ren
          Code pulls it into the workspace so Astra can read and edit your code.
        </p>
        <Link
          href="/dashboard/integrations"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-dusk px-5 text-[13px] font-medium text-carbon transition-opacity duration-200 hover:opacity-90"
        >
          <Github className="size-4" />
          Connect GitHub
        </Link>
      </div>
    );
  }

  const filtered = repos?.filter((r) =>
    r.fullName.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mt-6 rounded-xl border border-carbon-line bg-carbon-raised p-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-dusk-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your repositories…"
          className="w-full rounded-lg border border-carbon-line bg-carbon py-2.5 pl-9 pr-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
        />
      </div>

      <div className="platform-scroll mt-3 max-h-80 overflow-y-auto rounded-lg border border-carbon-line">
        {repos === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-dusk-faint">
            <Loader2 className="size-4 animate-spin" />
            Loading repositories…
          </div>
        ) : filtered && filtered.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-dusk-faint">
            No repositories found
          </p>
        ) : (
          <ul>
            {filtered?.map((repo, i) => (
              <li
                key={repo.id}
                className={cn("border-carbon-line", i !== 0 && "border-t")}
              >
                <button
                  onClick={() => {
                    setImportingId(repo.id);
                    onImport(repo);
                  }}
                  disabled={pending}
                  className="flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-carbon-high/50 disabled:opacity-60"
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
                  {importingId === repo.id && pending ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-brass" />
                  ) : (
                    <span className="shrink-0 rounded-md border border-carbon-line bg-carbon px-2.5 py-1 text-[11.5px] text-dusk-muted">
                      Pull in
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[11.5px] text-dusk-faint">
        The repository&apos;s files load into the workspace. Pushing later
        commits straight back to this same repo.
      </p>
    </div>
  );
}

function deriveName(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "";
  const firstLine = trimmed.split(/[.\n]/)[0];
  return truncate(firstLine, 60);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}
