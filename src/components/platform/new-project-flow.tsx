"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Github, Loader2, Sparkles } from "lucide-react";
import { newProjectExamples } from "@/lib/data/code";
import { createProject } from "@/lib/actions/projects";
import { cn } from "@/lib/utils";

type Mode = "new" | "repository";

interface ConnectedRepo {
  id: string;
  fullName: string;
}

interface NewProjectFlowProps {
  githubConnected: boolean;
  repositories: ConnectedRepo[];
}

export function NewProjectFlow({
  githubConnected,
  repositories,
}: NewProjectFlowProps) {
  const [mode, setMode] = useState<Mode>("new");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [repoId, setRepoId] = useState<string>(repositories[0]?.id ?? "");
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

  function submitRepository() {
    setError(null);
    const repo = repositories.find((r) => r.id === repoId);
    if (!repo) {
      setError("Choose a repository.");
      return;
    }
    startTransition(async () => {
      try {
        await createProject({
          name: name.trim() || repo.fullName.split("/").pop() || repo.fullName,
          kind: "repository",
          repositoryId: repo.id,
          description: `Work on ${repo.fullName}`,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create project.");
      }
    });
  }

  return (
    <div className="max-w-3xl">
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { id: "new" as Mode, icon: Sparkles, label: "New application", sub: "Start from a prompt" },
            { id: "repository" as Mode, icon: Github, label: "Existing repository", sub: "Build on your code" },
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
            <m.icon className={cn("size-5", mode === m.id ? "text-brass" : "text-dusk-faint")} />
            <span className="mt-4 text-[14px] font-medium text-dusk">{m.label}</span>
            <span className="mt-1 text-[12.5px] text-dusk-muted">{m.sub}</span>
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
              Creates a project in your workspace. Astra build generation
              activates with the private preview.
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
        <div className="mt-6 rounded-xl border border-carbon-line bg-carbon-raised p-5">
          {!githubConnected ? (
            <>
              <p className="text-[14px] leading-relaxed text-dusk">
                Connect your GitHub account to build on an existing repository.
                Ren Code will index it, learn its architecture, and let you work
                from there.
              </p>
              <Link
                href="/dashboard/integrations"
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-dusk px-5 text-[13px] font-medium text-carbon transition-opacity duration-200 hover:opacity-90"
              >
                <Github className="size-4" />
                Connect GitHub
              </Link>
            </>
          ) : repositories.length === 0 ? (
            <>
              <p className="text-[14px] leading-relaxed text-dusk">
                GitHub is connected, but you haven’t added any repositories yet.
                Add one so Ren Code can work on it.
              </p>
              <Link
                href="/dashboard/repositories"
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-brass px-5 text-[13px] font-medium text-carbon transition-colors duration-200 hover:bg-brass-deep"
              >
                Add a repository
                <ArrowRight className="size-3.5" />
              </Link>
            </>
          ) : (
            <>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dusk-faint">
                Repository
              </label>
              <select
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-carbon-line bg-carbon px-4 py-2.5 text-[14px] text-dusk outline-none transition-colors focus:border-carbon-line-strong"
              >
                {repositories.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                  </option>
                ))}
              </select>

              <label className="mt-5 block font-mono text-[10.5px] uppercase tracking-[0.14em] text-dusk-faint">
                Project name (optional)
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Defaults to the repository name"
                className="mt-2 w-full rounded-lg border border-carbon-line bg-carbon px-4 py-2.5 text-[14px] text-dusk outline-none transition-colors placeholder:text-dusk-faint focus:border-carbon-line-strong"
              />

              <div className="mt-5 flex justify-end border-t border-carbon-line pt-4">
                <button
                  onClick={submitRepository}
                  disabled={pending || !repoId}
                  className="flex h-10 items-center gap-2 rounded-lg bg-brass px-5 text-[13px] font-medium text-carbon transition-colors duration-200 hover:bg-brass-deep disabled:opacity-40"
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="size-3.5" />
                  )}
                  Create project
                </button>
              </div>
            </>
          )}
        </div>
      )}
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
