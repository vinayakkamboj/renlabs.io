/**
 * Astra inference — provider-agnostic entry point.
 *
 * Fireworks AI is the primary provider (direct infrastructure, SLA-backed).
 * Claude (Anthropic) is the fallback for when Fireworks is unreachable or
 * returns an error. Both paths are normalized to a plain UTF-8 text stream
 * so callers never see provider specifics. NEVER import this from a client
 * component.
 */

import {
  isFireworksConfigured,
  fireworksStream,
  fireworksSseToText,
  type ChatMsg,
} from "./fireworks";
import {
  isAnthropicConfigured,
  anthropicStream,
  anthropicSseToText,
} from "./anthropic";
import { extractUsage, type TokenUsage } from "./usage";

export type { ChatMsg };
export type { TokenUsage };

export type AstraProvider = "fireworks" | "anthropic";

/** True if any inference provider is configured. */
export function isAstraConfigured(): boolean {
  return isFireworksConfigured() || isAnthropicConfigured();
}

/** Which provider will serve requests right now (Fireworks wins if both set). */
export function activeProvider(): AstraProvider | null {
  if (isFireworksConfigured()) return "fireworks";
  if (isAnthropicConfigured()) return "anthropic";
  return null;
}

/** Configured providers in priority order (primary first). */
function providerChain(): AstraProvider[] {
  const chain: AstraProvider[] = [];
  if (isFireworksConfigured()) chain.push("fireworks");
  if (isAnthropicConfigured()) chain.push("anthropic");
  return chain;
}

export type AstraResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; provider: AstraProvider }
  | { ok: false; status: number; detail: string };

type StreamOpts = {
  temperature?: number;
  maxTokens?: number;
  /** Override the model id (e.g. a lighter model for the planning step). */
  model?: string;
  /** Fireworks reasoning effort: 'none' | 'low' | 'medium' | 'high' | 'max'. */
  reasoningEffort?: string;
  /** Abort signal — time-box a call so a slow provider can't hang the request. */
  signal?: AbortSignal;
};

/** Attempt a single provider; normalize its SSE or report the upstream error. */
async function tryProvider(
  provider: AstraProvider,
  messages: ChatMsg[],
  opts: StreamOpts,
): Promise<AstraResult> {
  const upstream =
    provider === "fireworks"
      ? await fireworksStream(messages, opts)
      : await anthropicStream(messages, opts);

  if (!upstream || !upstream.ok || !upstream.body) {
    if (!upstream) return { ok: false, status: 502, detail: "provider_unreachable" };
    const raw = await upstream.text().catch(() => "");
    let detail = raw.slice(0, 300);
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } | string };
      const m = typeof j.error === "string" ? j.error : j.error?.message;
      if (m) detail = m.slice(0, 300);
    } catch {
      /* non-JSON error body — keep the raw snippet */
    }
    return { ok: false, status: upstream.status || 502, detail };
  }

  const stream =
    provider === "fireworks"
      ? fireworksSseToText(upstream.body)
      : anthropicSseToText(upstream.body);

  return { ok: true, stream, provider };
}

/**
 * Stream Astra as plain text. Tries Fireworks first; if it errors and Claude
 * is configured, fails over before giving up.
 */
export async function streamAstraText(
  messages: ChatMsg[],
  opts: StreamOpts = {},
): Promise<AstraResult> {
  const chain = providerChain();
  if (chain.length === 0) return { ok: false, status: 503, detail: "not_configured" };

  let firstError: AstraResult | null = null;
  for (const provider of chain) {
    const result = await tryProvider(provider, messages, opts);
    if (result.ok) return result;
    if (!firstError) firstError = result;
  }
  return firstError ?? { ok: false, status: 502, detail: "all_providers_failed" };
}

/**
 * Run Astra to completion and return the full text. Used by non-streaming
 * callers like the autonomous agent runner that need the whole response before
 * parsing the file-patch block.
 */
export async function completeAstraText(
  messages: ChatMsg[],
  opts: StreamOpts = {},
): Promise<
  | { ok: true; text: string; usage: TokenUsage | null }
  | { ok: false; status: number; detail: string }
> {
  const result = await streamAstraText(messages, opts);
  if (!result.ok) return result;

  const reader = result.stream.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch (e) {
    return {
      ok: false,
      status: 502,
      detail: e instanceof Error ? e.message : "stream_read_failed",
    };
  }
  const { text, usage } = extractUsage(raw);
  return { ok: true, text, usage };
}
