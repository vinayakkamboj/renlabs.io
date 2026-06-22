/**
 * Astra inference — provider-agnostic entry point.
 *
 * Astra is served by OpenRouter when OPENROUTER_API_KEY is set; otherwise it
 * falls back to Claude (ANTHROPIC_API_KEY). If the primary provider errors but a
 * second provider is configured, we automatically fail over to it so a build is
 * never lost to one provider's hiccup. Both paths are normalized to a plain
 * UTF-8 text stream so callers never see provider specifics. NEVER import this
 * from a client component.
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

/** Configured providers in priority order (primary first). */
function providerChain(): AstraProvider[] {
  const chain: AstraProvider[] = [];
  if (isOpenRouterConfigured()) chain.push("openrouter");
  if (isAnthropicConfigured()) chain.push("anthropic");
  return chain;
}

export type AstraResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; provider: AstraProvider }
  | { ok: false; status: number; detail: string };

type StreamOpts = { temperature?: number; maxTokens?: number };

/** Attempt a single provider; normalize its SSE or report the upstream error. */
async function tryProvider(
  provider: AstraProvider,
  messages: ChatMsg[],
  opts: StreamOpts,
): Promise<AstraResult> {
  const upstream =
    provider === "openrouter"
      ? await openRouterStream(messages, opts)
      : await anthropicStream(messages, opts);

  if (!upstream || !upstream.ok || !upstream.body) {
    // No Response at all means the fetch threw (network/DNS) — report 502.
    if (!upstream) return { ok: false, status: 502, detail: "provider_unreachable" };
    const raw = await upstream.text().catch(() => "");
    // Both providers return JSON like { error: { message } } on failure; pull
    // out the human-readable message and pass the real status through so the
    // client can explain whether it's a bad key, model, or rate limit.
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
    provider === "openrouter"
      ? sseToText(upstream.body)
      : anthropicSseToText(upstream.body);

  return { ok: true, stream, provider };
}

/**
 * Stream Astra as plain text. Tries the primary provider first; if it errors and
 * another provider is configured, fails over to it before giving up. Returns the
 * first provider's error detail when every provider fails.
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
    // Otherwise loop on to the next configured provider (failover).
  }
  return firstError ?? { ok: false, status: 502, detail: "all_providers_failed" };
}
