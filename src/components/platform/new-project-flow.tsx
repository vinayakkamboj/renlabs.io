"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Github, Sparkles } from "lucide-react";
import { newProjectExamples } from "@/lib/data/code";
import { cn } from "@/lib/utils";

type Mode = "new" | "repository";

export function NewProjectFlow() {
  const [mode, setMode] = useState<Mode>("new");
  const [prompt, setPrompt] = useState("");

  return (
    <div className="max-w-3xl">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { id: "new" as Mode, icon: Sparkles, label: "New application", sub: "Start from a prompt" },
            { id: "repository" as Mode, icon: Github, label: "Existing repository", sub: "Build on your code" },
          ]
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
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

      {mode === "new" ? (
        <div className="mt-6 rounded-xl border border-carbon-line bg-carbon-raised p-5">
          <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dusk-faint">
            Describe what you want to build
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="A multi-tenant SaaS with authentication, billing, and a usage dashboard…"
            className="platform-scroll mt-3 w-full resize-none rounded-lg border border-carbon-line bg-carbon px-4 py-3 text-[14px] text-dusk outline-none transition-colors placeholder:text-dusk-faint focus:border-carbon-line-strong"
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
              Astra is actively evolving — project generation activates with
              the private preview.
            </p>
            <button
              disabled={!prompt.trim()}
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brass px-5 text-[13px] font-medium text-carbon transition-colors duration-200 hover:bg-brass-deep disabled:opacity-40"
            >
              Generate project
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-carbon-line bg-carbon-raised p-5">
          <p className="text-[14px] leading-relaxed text-dusk">
            Connect your GitHub account to select a repository. Ren Code will
            index it, learn its architecture, and let you work from there.
          </p>
          <Link
            href="/dashboard/integrations"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-dusk px-5 text-[13px] font-medium text-carbon transition-opacity duration-200 hover:opacity-90"
          >
            <Github className="size-4" />
            Connect GitHub
          </Link>
        </div>
      )}
    </div>
  );
}
