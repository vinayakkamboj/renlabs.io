/**
 * OpenRouter client — Astra is served through OpenRouter (an OpenAI-compatible
 * gateway). One key, one model id, configured by env so the model can change
 * without code edits. NEVER import this from a client component.
 *
 *   OPENROUTER_API_KEY   secret, server-only
 *   OPENROUTER_MODEL     the Astra model slug on OpenRouter
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** The Astra model slug on OpenRouter. */
export function astraModelId(): string {
  return process.env.OPENROUTER_MODEL ?? "z-ai/glm-4.6";
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
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
      messages,
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

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const data = line.trim();
          if (!data.startsWith("data:")) continue;
          const payload = data.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {
            // Partial JSON across a chunk boundary — wait for the rest.
          }
        }
      },
    }),
  );
}
