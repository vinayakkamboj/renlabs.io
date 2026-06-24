/**
 * OpenRouter client — Astra is served through OpenRouter (an OpenAI-compatible
 * gateway). One key, one model id, configured by env so the model can change
 * without code edits. NEVER import this from a client component.
 *
 *   OPENROUTER_API_KEY   secret, server-only
 *   OPENROUTER_MODEL     the Astra model slug on OpenRouter
 */

import { formatUsageMarker } from "./usage";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
  /** Optional image data URLs (data:image/…;base64,…) attached to this message. */
  images?: string[];
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** The Astra model slug on OpenRouter. Defaults to Claude Opus 4.8. */
export function astraModelId(): string {
  return process.env.OPENROUTER_MODEL ?? "anthropic/claude-opus-4.8";
}

/** Build an OpenAI-style message (multimodal when images are attached). */
function toOpenAIMessage(m: ChatMsg) {
  if (!m.images?.length) return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: [
      { type: "text", text: m.content },
      ...m.images.map((url) => ({ type: "image_url", image_url: { url } })),
    ],
  };
}

/**
 * Start a streaming completion. Returns the upstream fetch Response (OpenAI SSE)
 * or null if unreachable / unconfigured.
 */
export async function openRouterStream(
  messages: ChatMsg[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<Response | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://renlabs.io";

  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      // OpenRouter attribution headers.
      "HTTP-Referer": appUrl,
      "X-Title": "Ren Labs",
    },
    body: JSON.stringify({
      model: opts.model ?? astraModelId(),
      stream: true,
      // Ask the gateway to include a final usage chunk so we can report real
      // token counts back to the client.
      stream_options: { include_usage: true },
      // `temperature` is deprecated on the latest models (e.g. Claude Opus 4.8)
      // and the gateway returns a 400 if it's sent. Only include it when a
      // caller explicitly provides one.
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      max_tokens: opts.maxTokens ?? 2048,
      messages: messages.map(toOpenAIMessage),
    }),
  }).catch(() => null);
}

/**
 * Transform an upstream OpenAI-style SSE body into a plain-text token stream
 * (re-emitting `choices[].delta.content`).
 */
export function sseToText(
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  function processLine(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    const data = line.trim();
    if (!data.startsWith("data:")) return;
    const payload = data.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      // The final chunk (with include_usage) carries token counts.
      if (json.usage) {
        inputTokens = json.usage.prompt_tokens ?? inputTokens;
        outputTokens = json.usage.completion_tokens ?? outputTokens;
      }
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) controller.enqueue(encoder.encode(delta));
    } catch {
      // Partial JSON across a chunk boundary — wait for the rest.
    }
  }

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line, controller);
      },
      flush(controller) {
        if (buffer) {
          processLine(buffer, controller);
          buffer = "";
        }
        controller.enqueue(
          encoder.encode(formatUsageMarker({ inputTokens, outputTokens })),
        );
      },
    }),
  );
}
