"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  FileCode2,
  Gauge,
  ImagePlus,
  Layers,
  Loader2,
  Sparkles,
  Square,
  Wand2,
  X,
} from "lucide-react";
import { RenMark } from "@/components/ui/wordmark";
import { MarkdownContent } from "@/components/ui/markdown";
import { useWorkspaceStore } from "@/lib/builder/store";
import { ASTRA_MODEL } from "@/lib/builder/model-tiers";
import type { BuildMessage } from "@/lib/builder/types";

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
  const stopBuild = useWorkspaceStore((s) => s.stopBuild);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingText]);

  const MAX_IMAGES = 4;
  const MAX_BYTES = 4 * 1024 * 1024; // 4MB per image

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_BYTES)
      .slice(0, Math.max(0, room));
    const urls = await Promise.all(
      picked.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(f);
          }),
      ),
    );
    setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
  }

  function submit() {
    if ((!input.trim() && images.length === 0) || isBuilding) return;
    sendMessage(input, images);
    setInput("");
    setImages([]);
  }

  return (
    <div className="flex h-full flex-col bg-carbon">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-carbon-line px-4">
        <RenMark className="size-4 text-brass" />
        <span className="font-serif text-[1.05rem] font-medium tracking-tight text-dusk">
          Ren Labs
        </span>
        <span className="ml-auto rounded-full border border-carbon-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-dusk-faint">
          Astra
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
              <button
                onClick={stopBuild}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-carbon-line px-2 py-1 text-[11px] font-medium text-dusk-muted transition-colors hover:border-signal-red/40 hover:text-signal-red"
              >
                <Square className="size-3 fill-current" />
                Stop
              </button>
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
        <ModelIndicator />
        <div className="mt-2 overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised focus-within:border-carbon-line-strong">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {images.map((src, i) => (
                <div key={i} className="group relative size-14 overflow-hidden rounded-lg border border-carbon-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="attachment" className="size-full object-cover" />
                  <button
                    onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-carbon/80 text-dusk opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const imgs = Array.from(e.clipboardData.files).filter((f) =>
                f.type.startsWith("image/"),
              );
              if (imgs.length) {
                e.preventDefault();
                const dt = new DataTransfer();
                imgs.forEach((f) => dt.items.add(f));
                void addFiles(dt.files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder="Describe a change — or attach a screenshot to build from…"
            className="platform-scroll w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-dusk outline-none placeholder:text-dusk-faint/70"
          />
          <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={images.length >= MAX_IMAGES}
                title="Attach image"
                className="flex size-7 items-center justify-center rounded-lg text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk disabled:opacity-30"
              >
                <ImagePlus className="size-4" />
              </button>
              <span className="text-[10.5px] text-dusk-faint/70">⏎ send · ⇧⏎ newline</span>
            </div>
            {isBuilding ? (
              <button
                onClick={stopBuild}
                title="Stop Astra"
                className="flex size-7 items-center justify-center rounded-lg bg-signal-red/90 text-white transition-all hover:bg-signal-red"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!input.trim() && images.length === 0}
                className="flex size-7 items-center justify-center rounded-lg bg-brass text-carbon transition-all hover:bg-brass-deep disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({ message }: { message: BuildMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {message.images && message.images.length > 0 && (
          <div className="flex max-w-[88%] flex-wrap justify-end gap-1.5">
            {message.images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt="attachment"
                className="size-20 rounded-lg border border-carbon-line object-cover"
              />
            ))}
          </div>
        )}
        {message.content && (
          <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-carbon-high px-3.5 py-2.5 text-[13px] leading-relaxed text-dusk">
            {message.content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <MarkdownContent text={message.content} className="text-[13px]" />
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
        {message.usage && message.usage.outputTokens > 0 && (
          <UsageLine usage={message.usage} />
        )}
      </div>
    </div>
  );
}

/** Per-turn token/credit cost shown subtly under an assistant reply. */
function UsageLine({
  usage,
}: {
  usage: NonNullable<BuildMessage["usage"]>;
}) {
  const total = usage.inputTokens + usage.outputTokens;
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  return (
    <div className="mt-2 flex items-center gap-2 font-mono text-[10.5px] text-dusk-faint">
      <Gauge className="size-3 text-dusk-faint" />
      <span title={`${usage.inputTokens.toLocaleString()} in · ${usage.outputTokens.toLocaleString()} out`}>
        {fmt(total)} tokens
      </span>
      <span className="text-dusk-faint/60">·</span>
      <span>
        {fmt(usage.inputTokens)} in / {fmt(usage.outputTokens)} out
      </span>
      {usage.creditsDeducted ? (
        <>
          <span className="text-dusk-faint/60">·</span>
          <span className="text-signal-amber">−{usage.creditsDeducted} credits</span>
        </>
      ) : null}
    </div>
  );
}

/**
 * Single-model indicator. Astra runs one model, so this is a calm status line
 * rather than a picker — a live dot, the model name, and the Ren Labs mark.
 */
function ModelIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-carbon-line bg-carbon-raised px-3 py-2">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal-green/70" />
        <span className="relative inline-flex size-1.5 rounded-full bg-signal-green" />
      </span>
      <span className="text-[12.5px] font-medium text-dusk">
        {ASTRA_MODEL.brandName}
      </span>
      <span className="ml-auto flex items-center gap-1.5 text-[11px] text-dusk-faint">
        <RenMark className="size-3 text-brass/70" />
        Ren Labs
      </span>
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
      <div className="flex items-center gap-2">
        <RenMark className="size-5 text-brass" />
        <span className="font-serif text-[1.25rem] font-medium tracking-tight text-dusk">
          Ren Labs
        </span>
      </div>
      <p className="mt-4 text-[14px] font-semibold text-dusk">
        Start building with Astra
      </p>
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
