/**
 * Astra inference — provider-agnostic entry point.
 *
 * Astra is served by OpenRouter when OPENROUTER_API_KEY is set; otherwise it
 * falls back to Claude (ANTHROPIC_API_KEY). Both paths are normalized to a plain
 * UTF-8 text stream so callers (and the client reader) never see provider
 * specifics. NEVER import this from a client component.
 */

import {
  isOpenRouterConfigured,
  openRouterStream,
  sseToText,
  type ChatMsg,
} from "./openrouter";
import {
  isAnthropicConfigured,
  anthropicStream,
  anthropicSseToText,
} from "./anthropic";

export type { ChatMsg };

export type AstraProvider = "openrouter" | "anthropic";

/** True if any inference provider is configured. */
export function isAstraConfigured(): boolean {
  return isOpenRouterConfigured() || isAnthropicConfigured();
}

/** Which provider will serve requests right now (OpenRouter wins if both set). */
export function activeProvider(): AstraProvider | null {
  if (isOpenRouterConfigured()) return "openrouter";
  if (isAnthropicConfigured()) return "anthropic";
  return null;
}

export type AstraResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; provider: AstraProvider }
  | { ok: false; status: number; detail: string };

/**
 * Stream Astra as plain text. Picks the configured provider, normalizes the SSE
 * format, and surfaces upstream errors as a structured result.
 */
export async function streamAstraText(
  messages: ChatMsg[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<AstraResult> {
  const provider = activeProvider();
  if (!provider) return { ok: false, status: 503, detail: "not_configured" };

  const upstream =
    provider === "openrouter"
      ? await openRouterStream(messages, opts)
      : await anthropicStream(messages, opts);

  if (!upstream || !upstream.ok || !upstream.body) {
    const detail = upstream ? await upstream.text().catch(() => "") : "";
    return { ok: false, status: 502, detail: detail.slice(0, 500) };
  }

  const stream =
    provider === "openrouter"
      ? sseToText(upstream.body)
      : anthropicSseToText(upstream.body);

  return { ok: true, stream, provider };
}
