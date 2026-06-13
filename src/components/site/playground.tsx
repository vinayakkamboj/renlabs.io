"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ChevronDown } from "lucide-react";
import { RenMark } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils";

interface Turn {
  id: number;
  role: "user" | "assistant";
  content: string;
  deliberation?: string;
  deliberationSeconds?: number;
  confidence?: number;
}

/** Pre-composed fallbacks shown when no inference server is configured. */
const cannedResponses: Omit<Turn, "id" | "role">[] = [
  {
    content:
      "This is a demonstration environment, so I'll be precise about what I can and can't do here: responses are pre-composed previews of the production interface, not live inference. What you're seeing — the deliberation trace, the confidence score, the source attribution — is exactly how Ren presents its work in production.",
    deliberation:
      "The user is exploring the playground preview. The honest framing is to state clearly that this is a demonstration, while showing the interface elements that make Ren different: visible reasoning, calibrated confidence, and explicit sourcing.",
    deliberationSeconds: 2.4,
    confidence: 0.97,
  },
  {
    content:
      "A fair question to ask any model — and one I'd rather answer carefully than impressively. The honest answer today: Ren AI is in active development, and Astra, the flagship language model behind Ren Code, is actively evolving. Capability and calibration numbers will be published alongside the evaluation harness that produces them — not before.",
    deliberation:
      "Considering how to explain calibration without overclaiming. The key distinction: a confidence score is only meaningful if it's been measured against outcomes. Citing the published paper keeps the claim checkable.",
    deliberationSeconds: 4.1,
    confidence: 0.93,
  },
  {
    content:
      "I don't know — and in the production system, this is precisely the moment I'd say so rather than guess. Below a confidence threshold, Ren is trained to stop, state what it would need to verify, and ask. An honest \"I don't know\" preserves something more valuable than the appearance of omniscience: your ability to trust the answers that come with high confidence.",
    deliberation:
      "The request goes beyond what can be verified in this environment. Options: fabricate a plausible answer (rejected — confident error is the primary failure mode we train against) or state uncertainty explicitly and explain the escalation behavior.",
    deliberationSeconds: 5.8,
    confidence: 0.41,
  },
];

const suggestions = [
  "What makes this different from other chat interfaces?",
  "How is your confidence score calibrated?",
  "Tell me something you can't verify",
];

function DeliberationBlock({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(true);
  if (!turn.deliberation) return null;
  return (
    <div className="rounded-xl border border-line bg-paper-deep/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-bronze">
          Deliberation · {turn.deliberationSeconds?.toFixed(1)}s
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-graphite-soft transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3.5 text-[13px] leading-relaxed text-graphite">
              {turn.deliberation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Backend = "unknown" | "live" | "demo";

export function Playground() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [backend, setBackend] = useState<Backend>("unknown");
  const [modelId, setModelId] = useState("astra");
  const nextId = useRef(0);
  const responseIndex = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length > 0 || thinking) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turns, thinking]);

  function appendCanned() {
    const reply = cannedResponses[responseIndex.current % cannedResponses.length];
    responseIndex.current += 1;
    window.setTimeout(() => {
      setTurns((t) => [...t, { id: nextId.current++, role: "assistant", ...reply }]);
      setThinking(false);
    }, 1400);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setInput("");

    const history = [...turns, { id: -1, role: "user" as const, content: trimmed }];
    setTurns((t) => [...t, { id: nextId.current++, role: "user", content: trimmed }]);
    setThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        setBackend("demo");
        appendCanned();
        return;
      }

      setBackend("live");
      const served = res.headers.get("x-ren-model");
      if (served) setModelId(served);

      const assistantId = nextId.current++;
      setTurns((t) => [...t, { id: assistantId, role: "assistant", content: "" }]);
      setThinking(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setTurns((t) =>
          t.map((turn) =>
            turn.id === assistantId ? { ...turn, content: snapshot } : turn,
          ),
        );
      }
    } catch {
      setBackend("demo");
      appendCanned();
    }
  }

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-screen flex-col pt-16">
      {/* Session bar */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-6">
          <div className="flex items-center gap-5 font-mono text-[11px] text-graphite">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  backend === "live" ? "bg-signal-green" : "bg-bronze",
                )}
              />
              {modelId}
            </span>
            <span className="hidden text-graphite-soft sm:inline">
              {backend === "live" ? "local inference · streaming" : "deliberation · adaptive"}
            </span>
          </div>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-soft">
            {backend === "live" ? "Live" : backend === "demo" ? "Demo mode" : "Research preview"}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
            <RenMark className="size-10 text-bronze" />
            <h1 className="mt-8 font-serif text-display font-normal text-ink">
              What are we working on?
            </h1>
            <p className="mt-4 max-w-[42ch] text-lede text-graphite">
              Every response carries its reasoning, its sources, and an honest
              statement of confidence.
            </p>
            <div className="mt-10 flex flex-col gap-2.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-line bg-paper-raised px-5 py-2.5 text-[13.5px] text-ink-soft transition-all duration-300 hover:border-stone hover:bg-paper-deep"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-8 py-10">
            {turns.map((turn) =>
              turn.role === "user" ? (
                <motion.div
                  key={turn.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex justify-end"
                >
                  <p className="max-w-[46ch] whitespace-pre-wrap rounded-2xl rounded-br-md bg-paper-deep px-5 py-3.5 text-[15px] leading-relaxed text-ink">
                    {turn.content}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={turn.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-4"
                >
                  <DeliberationBlock turn={turn} />
                  <div className="flex gap-4">
                    <RenMark className="mt-1.5 size-4 shrink-0 text-bronze" />
                    <p className="whitespace-pre-wrap text-[15px] leading-[1.75] text-ink-soft text-pretty">
                      {turn.content || "…"}
                    </p>
                  </div>
                  {turn.confidence !== undefined && (
                    <div className="flex items-center gap-2 pl-8 font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-soft">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          turn.confidence >= 0.85
                            ? "bg-bronze"
                            : turn.confidence >= 0.6
                              ? "bg-signal-amber"
                              : "bg-signal-red",
                        )}
                      />
                      Confidence ·{" "}
                      {turn.confidence >= 0.85 ? "high" : turn.confidence >= 0.6 ? "moderate" : "low"}{" "}
                      ({turn.confidence.toFixed(2)})
                    </div>
                  )}
                </motion.div>
              ),
            )}
            {thinking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-bronze"
              >
                <motion.span
                  className="block size-3 rounded-full border border-bronze"
                  animate={{ scale: [1, 0.7, 1], opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
                Deliberating
              </motion.div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {/* Composer */}
        <div className="sticky bottom-0 bg-gradient-to-t from-paper via-paper to-transparent pb-8 pt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-line-strong bg-paper-raised p-2.5 shadow-lift transition-shadow duration-300 focus-within:shadow-float"
          >
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
              placeholder="Ask Ren…"
              className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-ink outline-none placeholder:text-graphite-soft"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              aria-label="Send"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition-all duration-300 hover:bg-ink-soft disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
          <p className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-soft">
            {backend === "live"
              ? `Streaming from ${modelId} · set INFERENCE_BASE_URL to change backends`
              : "Demo mode · start an inference server and set INFERENCE_BASE_URL to go live"}
          </p>
        </div>
      </div>
    </div>
  );
}
