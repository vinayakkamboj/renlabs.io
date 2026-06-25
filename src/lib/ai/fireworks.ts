/**
 * Fireworks AI client — primary inference provider for Astra.
 *
 * Fireworks owns its own GPU infrastructure (H100/H200/B200) and offers
 * direct access to GLM 5.2 with no middleman markup. NEVER import this
 * from a client component.
 *
 *   FIREWORKS_API_KEY    secret, server-only
 *   FIREWORKS_MODEL      model slug (default: accounts/fireworks/models/glm-5p2-fp8)
 */

import { formatUsageMarker } from "./usage";

const FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
  /** Optional image data URLs (data:image/…;base64,…) attached to this message. */
  images?: string[];
}

export function isFireworksConfigured(): boolean {
  return Boolean(process.env.FIREWORKS_API_KEY);
}

/**
 * The Fireworks model slug. Defaults to GLM 5.2 FP8 (full precision, best quality).
 * Use accounts/fireworks/models/glm-5p2 for the quantized (slightly cheaper) variant.
 */
export function fireworksModelId(): string {
  return process.env.FIREWORKS_MODEL ?? "accounts/fireworks/models/glm-5p2-fp8";
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
 * Start a streaming completion via Fireworks. Returns the upstream fetch Response
 * (OpenAI-compatible SSE) or null if unreachable / unconfigured.
 */
export async function fireworksStream(
  messages: ChatMsg[],
  opts: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** GLM 5.2 reasoning effort: 'low' | 'medium' | 'high' | 'max' */
    reasoningEffort?: string;
  } = {},
): Promise<Response | null> {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key) return null;

  return fetch(FIREWORKS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model ?? fireworksModelId(),
      stream: true,
      max_tokens: opts.maxTokens ?? 4096,
      // temperature is not supported on GLM 5.2 reasoning models — only include
      // when a caller explicitly provides one.
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      // reasoning_effort controls GLM 5.2's thinking depth: low/medium/high/max
      ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      messages: messages.map(toOpenAIMessage),
    }),
  }).catch(() => null);
}

/**
 * Transform a Fireworks SSE body into a plain-text token stream.
 *
 * Fireworks uses OpenAI-compatible SSE format with one difference: token
 * usage is reported in the final chunk's `perf_metrics` field (not `usage`).
 *   perf_metrics.prompt_tokens    → input tokens
 *   perf_metrics.completion_tokens → output tokens
 */
export function fireworksSseToText(
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
        // Fireworks reports usage in perf_metrics on the final chunk
        perf_metrics?: { prompt_tokens?: number; completion_tokens?: number };
      };
      if (json.perf_metrics) {
        inputTokens = json.perf_metrics.prompt_tokens ?? inputTokens;
        outputTokens = json.perf_metrics.completion_tokens ?? outputTokens;
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
