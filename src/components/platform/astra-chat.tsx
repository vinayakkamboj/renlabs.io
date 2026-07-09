"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Loader2, X } from "lucide-react";
import { RenMark } from "@/components/ui/wordmark";
import { MarkdownContent } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

const SUGGESTIONS = [
  "Explain the difference between SQL and NoSQL",
  "Write a debounce function in TypeScript",
  "How does OAuth 2.0 work?",
  "Refactor this loop to be more readable",
];

const MAX_IMAGES = 4;
const MAX_BYTES = 4 * 1024 * 1024;

export function AstraChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamText]);

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

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && images.length === 0) || streaming) return;
    setError(null);

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      images: images.length > 0 ? [...images] : undefined,
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setImages([]);
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/astra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role,
            content: m.content,
            // Forward attached images so Astra actually sees (scans) them.
            ...(m.images?.length ? { images: m.images } : {}),
          })),
        }),
      });

      if (res.status === 429) {
        setError("You've reached today's chat limit. Come back tomorrow.");
        setStreaming(false);
        return;
      }
      if (res.status === 503) {
        setError("Astra isn't configured yet (set OPENROUTER_API_KEY).");
        setStreaming(false);
        return;
      }
      if (!res.ok || !res.body) throw new Error("failed");

      const rem = res.headers.get("x-astra-remaining");
      if (rem) setRemaining(parseInt(rem, 10));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamText(full);
      }
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: full },
      ]);
      setStreamText("");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0 && !streaming;

  return (
    // No header bar of its own — the dashboard shell already provides the top
    // navigation, and a second bar here read as a broken double navbar.
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="platform-scroll flex-1 overflow-y-auto py-6">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <RenMark className="size-7 text-brass" />
            <p className="mt-4 text-[15px] font-medium text-dusk">
              Ask Astra anything
            </p>
            <p className="mt-1.5 text-[13px] text-dusk-faint">
              Code, explanations, ideas — Ren Labs&apos; own model.
            </p>
            <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-carbon-line bg-carbon-raised px-3.5 py-2.5 text-left text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5">
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} content={m.content} images={m.images} />
            ))}
            {streaming && (
              streamText ? (
                <Bubble role="assistant" content={streamText} />
              ) : (
                <ThinkingDots />
              )
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mb-2 text-center text-[12px] text-signal-red">{error}</p>
      )}

      {/* Composer */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-carbon-line bg-carbon-raised focus-within:border-carbon-line-strong">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {images.map((src, idx) => (
                <div
                  key={idx}
                  className="group relative size-14 overflow-hidden rounded-lg border border-carbon-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="attachment" className="size-full object-cover" />
                  <button
                    onClick={() => setImages((p) => p.filter((_, j) => j !== idx))}
                    className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-carbon/80 text-dusk opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove"
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
                send(input);
              }
            }}
            rows={1}
            placeholder="Message Astra…"
            className="platform-scroll max-h-40 w-full resize-none bg-transparent px-3.5 pt-3 text-[14px] text-dusk outline-none placeholder:text-dusk-faint"
          />
          <div className="flex items-center gap-2 px-2 pb-2 pt-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={images.length >= MAX_IMAGES}
              title="Attach image"
              className="flex size-8 items-center justify-center rounded-xl text-dusk-faint transition-colors hover:bg-carbon-high hover:text-dusk disabled:opacity-30"
            >
              <ImagePlus className="size-4" />
            </button>
            <span className="text-[10.5px] text-dusk-faint/60">⏎ send · ⇧⏎ newline</span>
            {remaining !== null && (
              <span className="text-[10.5px] text-dusk-faint/60">
                · {remaining} left today
              </span>
            )}
            <div className="ml-auto">
              <button
                onClick={() => send(input)}
                disabled={(!input.trim() && images.length === 0) || streaming}
                className="flex size-9 items-center justify-center rounded-xl bg-brass text-carbon transition-colors hover:bg-brass-deep disabled:opacity-30"
              >
                {streaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[10.5px] text-dusk-faint">
          Astra can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brass/15">
        <RenMark className="size-3.5 text-brass" />
      </div>
      <div className="flex items-center gap-1 py-1.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-dusk-faint/50"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  images,
}: {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}) {
  if (role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {images && images.length > 0 && (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
            {images.map((src, i) => (
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
        {content && (
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-carbon-high px-4 py-2.5 text-[13.5px] leading-relaxed text-dusk">
            {content}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brass/15">
        <RenMark className="size-3.5 text-brass" />
      </div>
      <div className={cn("min-w-0 flex-1")}>
        <MarkdownContent text={content} />
      </div>
    </div>
  );
}
