"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  FileCode2,
  Layers,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/builder/store";
import { MODEL_TIERS, type ModelTierId } from "@/lib/builder/model-tiers";
import type { BuildMessage } from "@/lib/builder/types";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<string, string> = {
  thinking: "Astra is planning",
  writing: "Writing files",
  applying: "Applying changes",
};

export function ChatPanel() {
  const messages = useWorkspaceStore((s) => s.messages);
  const isBuilding = useWorkspaceStore((s) => s.isBuilding);
  const phase = useWorkspaceStore((s) => s.phase);
  const streamingText = useWorkspaceStore((s) => s.streamingText);
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingText]);

  function submit() {
    if (!input.trim() || isBuilding) return;
    sendMessage(input);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col bg-carbon">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-carbon-line px-4">
        <span className="text-[12px] font-semibold tracking-wide text-brass">
          Astra
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-dusk-faint/60">
          AI Builder
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="platform-scroll flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </div>
        )}

        {isBuilding && (
          <div className="mt-5 overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised">
            <div className="flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-brass">
              <Loader2 className="size-3.5 animate-spin" />
              <span>{PHASE_LABEL[phase] ?? "Working"}…</span>
            </div>
            {streamingText && (
              <div className="border-t border-carbon-line px-3 py-2.5">
                <p className="line-clamp-5 whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-dusk-faint">
                  {streamingText}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-carbon-line p-3">
        <ModelPicker />
        <div className="mt-2 overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised focus-within:border-carbon-line-strong">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder="Describe a change — a page, a feature, a fix…"
            className="platform-scroll w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint/70"
          />
          <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
            <div className="flex items-center gap-1.5 text-[10.5px] text-dusk-faint/70">
              <span>⏎ send · ⇧⏎ newline</span>
            </div>
            <button
              onClick={submit}
              disabled={!input.trim() || isBuilding}
              className="flex size-7 items-center justify-center rounded-lg bg-brass text-carbon transition-all hover:bg-brass-deep disabled:opacity-30"
            >
              {isBuilding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({ message }: { message: BuildMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-carbon-high px-3.5 py-2.5 text-[13px] leading-relaxed text-dusk">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-dusk-muted">
          {message.content}
        </p>
        {message.plan && (
          <div className="mt-2.5 overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised">
            <div className="border-b border-carbon-line px-3 py-2">
              <p className="text-[12.5px] font-medium text-brass">
                {message.plan.summary}
              </p>
            </div>
            <ul className="space-y-0.5 p-2">
              {message.plan.files.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-carbon-high"
                >
                  <FileCode2 className="size-3 shrink-0 text-brass/50" />
                  <span className="font-mono text-[11.5px] text-dusk-faint">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ModelPicker() {
  const modelTier = useWorkspaceStore((s) => s.modelTier);
  const setModelTier = useWorkspaceStore((s) => s.setModelTier);
  const [open, setOpen] = useState(false);
  const active = MODEL_TIERS.find((t) => t.id === modelTier)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-carbon-line bg-carbon-raised px-3 py-2 text-left transition-colors hover:border-carbon-line-strong"
      >
        <span className="flex items-center gap-2 text-[12px]">
          <span className="text-dusk">{active.brandName}</span>
          <span className="text-[11px] text-dusk-faint">· {active.usageLevel}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-dusk-faint transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-20 mb-1.5 w-full overflow-hidden rounded-xl border border-carbon-line-strong bg-carbon-raised shadow-2xl">
            {MODEL_TIERS.map((tier) => {
              const isActive = tier.id === modelTier;
              return (
                <button
                  key={tier.id}
                  onClick={() => {
                    setModelTier(tier.id as ModelTierId);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-carbon-high",
                    isActive && "bg-carbon-high",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[12.5px] font-medium",
                          isActive ? "text-brass" : "text-dusk-muted",
                        )}
                      >
                        {tier.brandName}
                      </span>
                      <span className="text-[10.5px] text-dusk-faint">{tier.usageLevel}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-dusk-faint">{tier.tagline}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const EXAMPLES = [
  {
    icon: Layers,
    text: "Build a project management board with draggable columns",
  },
  {
    icon: Sparkles,
    text: "Create a landing page for a coffee subscription brand",
  },
  {
    icon: Wand2,
    text: "Make an expense tracker with charts and categories",
  },
];

function EmptyState() {
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  return (
    <div className="flex h-full flex-col items-center justify-center py-8 text-center">
      <p className="text-[15px] font-semibold tracking-wide text-brass">Astra</p>
      <p className="mt-3 text-[14px] font-semibold text-dusk">Start with Astra</p>
      <p className="mt-1.5 max-w-[30ch] text-[12.5px] leading-relaxed text-dusk-faint">
        Describe what you want to build. Astra writes the code, wires the
        state, and renders it live.
      </p>
      <div className="mt-5 w-full space-y-2">
        {EXAMPLES.map(({ icon: Icon, text }) => (
          <button
            key={text}
            onClick={() => sendMessage(text)}
            className="flex w-full items-start gap-2.5 rounded-xl border border-carbon-line bg-carbon-raised px-3 py-2.5 text-left transition-all hover:border-carbon-line-strong hover:bg-carbon-high"
          >
            <Icon className="mt-0.5 size-3.5 shrink-0 text-brass/50" />
            <span className="text-[12px] leading-relaxed text-dusk-muted">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
