/**
 * Anthropic (Claude) provider — the fallback engine for Astra when OpenRouter
 * isn't configured. Same role as openrouter.ts but speaks the Anthropic Messages
 * API (system is a top-level field; image parts use a base64 source block).
 * NEVER import this from a client component.
 *
 *   ANTHROPIC_API_KEY   secret, server-only
 *   ANTHROPIC_MODEL     the Claude model id (default: a current Claude model)
 */

import type { ChatMsg } from "./openrouter";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function anthropicModelId(): string {
  // Default to the strongest coding-capable Claude. Override with ANTHROPIC_MODEL.
  return process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
}

/** Split a data URL into Anthropic's { media_type, data } image source. */
function parseDataUrl(url: string): { media_type: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url);
  if (!m) return null;
  return { media_type: m[1], data: m[2] };
}

/** Build an Anthropic content block list for a user/assistant message. */
function toAnthropicContent(m: ChatMsg) {
  if (!m.images?.length) return m.content;
  const parts: unknown[] = [{ type: "text", text: m.content }];
  for (const url of m.images) {
    const src = parseDataUrl(url);
    if (src) {
      parts.push({
        type: "image",
        source: { type: "base64", media_type: src.media_type, data: src.data },
      });
    }
  }
  return parts;
}

/**
 * Start a streaming completion via Claude. Returns the upstream fetch Response
 * (Anthropic SSE) or null if unreachable / unconfigured.
 */
export async function anthropicStream(
  messages: ChatMsg[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<Response | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  // Anthropic takes the system prompt as a top-level field, and only
  // user/assistant turns in `messages`.
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: toAnthropicContent(m) }));

  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model ?? anthropicModelId(),
      stream: true,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
      system: system || undefined,
      messages: turns,
    }),
  }).catch(() => null);
}

/**
 * Transform an Anthropic SSE body into a plain-text token stream, re-emitting
 * the `content_block_delta` text deltas so the client reader is provider-agnostic.
 */
export function anthropicSseToText(
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  function processLine(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    const data = line.trim();
    if (!data.startsWith("data:")) return;
    const payload = data.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload) as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (
        json.type === "content_block_delta" &&
        json.delta?.type === "text_delta" &&
        json.delta.text
      ) {
        controller.enqueue(encoder.encode(json.delta.text));
      }
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
        // Process any remaining buffered content when the stream ends.
        if (buffer) {
          processLine(buffer, controller);
          buffer = "";
        }
      },
    }),
  );
}
