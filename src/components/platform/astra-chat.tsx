"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { RenMark } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Explain the difference between SQL and NoSQL",
  "Write a debounce function in TypeScript",
  "How does OAuth 2.0 work?",
  "Refactor this loop to be more readable",
];

export function AstraChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamText]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/astra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
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
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-carbon-line pb-3">
        <div className="flex items-center gap-2">
          <RenMark className="size-4 text-brass" />
          <span className="font-serif text-[1.05rem] font-medium tracking-tight text-dusk">
            Astra
          </span>
          <span className="rounded-full border border-carbon-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-dusk-faint">
            Chat
          </span>
        </div>
        {remaining !== null && (
          <span className="text-[11.5px] text-dusk-faint">
            {remaining} message{remaining !== 1 ? "s" : ""} left today
          </span>
        )}
      </div>

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
              <Bubble key={m.id} role={m.role} content={m.content} />
            ))}
            {streaming && (
              <Bubble role="assistant" content={streamText || "…"} />
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mb-2 text-center text-[12px] text-signal-red">{error}</p>
      )}

      {/* Composer */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-end gap-2 rounded-2xl border border-carbon-line bg-carbon-raised p-2 focus-within:border-carbon-line-strong">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Message Astra…"
            className="platform-scroll max-h-40 flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] text-dusk outline-none placeholder:text-dusk-faint"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="flex size-9 items-center justify-center rounded-xl bg-brass text-carbon transition-colors hover:bg-brass-deep disabled:opacity-30"
          >
            {streaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10.5px] text-dusk-faint">
          Astra can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-carbon-high px-4 py-2.5 text-[13.5px] leading-relaxed text-dusk">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brass/15">
        <RenMark className="size-3.5 text-brass" />
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-dusk-muted",
        )}
      >
        {content}
      </div>
    </div>
  );
}
