"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Github, Loader2, Lock, Plus, Search } from "lucide-react";
import { addRepository } from "@/lib/actions/repositories";

interface GithubRepo {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
}

interface RepoPickerProps {
  /** full_name values already added to the workspace, so we can show them as added */
  existing: string[];
}

export function RepoPicker({ existing }: RepoPickerProps) {
  const router = useRouter();
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set(existing));
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/github/repositories")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not load repositories.");
        }
        return res.json();
      })
      .then((data: { repositories: GithubRepo[] }) => {
        if (!cancelled) setRepos(data.repositories);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function add(repo: GithubRepo) {
    if (busy || added.has(repo.fullName)) return;
    setBusy(repo.fullName);
    try {
      await addRepository({
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.private,
        language: repo.language,
      });
      setAdded((prev) => new Set(prev).add(repo.fullName));
      startTransition(() => router.refresh());
    } catch {
      setError(`Could not add ${repo.fullName}.`);
    } finally {
      setBusy(null);
    }
  }

  const filtered = (repos ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(query.toLowerCase()),
  );

  if (error) {
    return (
      <div className="rounded-xl border border-carbon-line bg-carbon-raised p-5">
        <p className="text-[13px] text-signal-red">{error}</p>
      </div>
    );
  }

  if (repos === null) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-carbon-line bg-carbon-raised p-5 text-[13px] text-dusk-muted">
        <Loader2 className="size-4 animate-spin text-brass" />
        Loading your GitHub repositories…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised">
      <div className="flex items-center gap-2.5 border-b border-carbon-line px-4 py-2.5">
        <Search className="size-4 text-dusk-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories…"
          className="w-full bg-transparent text-[13px] text-dusk outline-none placeholder:text-dusk-faint"
        />
        <span className="shrink-0 font-mono text-[11px] text-dusk-faint">
          {filtered.length}
        </span>
      </div>

      <ul className="platform-scroll max-h-[420px] divide-y divide-carbon-line/60 overflow-y-auto">
        {filtered.map((repo) => {
          const isAdded = added.has(repo.fullName);
          const isBusy = busy === repo.fullName;
          return (
            <li
              key={repo.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Github className="size-3.5 shrink-0 text-dusk-faint" />
                  <span className="truncate font-mono text-[12.5px] text-dusk">
                    {repo.fullName}
                  </span>
                  {repo.private ? (
                    <Lock className="size-3 shrink-0 text-dusk-faint" />
                  ) : null}
                </div>
                {repo.description ? (
                  <p className="mt-1 truncate text-[12px] text-dusk-muted">
                    {repo.description}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => add(repo)}
                disabled={isAdded || isBusy || pending}
                className={
                  isAdded
                    ? "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-signal-green/30 bg-signal-green/10 px-3 text-[12px] font-medium text-signal-green"
                    : "flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brass px-3 text-[12px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
                }
              >
                {isBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isAdded ? (
                  <Check className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                {isAdded ? "Added" : "Add"}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="px-4 py-8 text-center text-[13px] text-dusk-muted">
            No repositories match “{query}”.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
