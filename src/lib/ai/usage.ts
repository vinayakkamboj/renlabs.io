/**
 * Token-usage sentinel for the Astra text stream.
 *
 * The builder/astra streams are plain UTF-8 text (provider-agnostic). To carry
 * real token usage back to the client without a second request — and without
 * corrupting the file-patch parser — the provider normalizers append a single
 * record-separator-delimited marker at the very end of the stream. The client
 * (and completeAstraText) extract and strip it before any parsing, so it never
 * appears in generated code or chat prose.
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** ASCII record separator — will never appear in model code/prose output. */
const RS = "";

/** Build the trailing usage marker appended to a finished stream. */
export function formatUsageMarker(usage: TokenUsage): string {
  return `${RS}REN_USAGE:${JSON.stringify(usage)}${RS}`;
}

const MARKER_RE = new RegExp(`${RS}REN_USAGE:(\\{[^${RS}]*\\})${RS}`);

/** Pull the usage marker out of a stream's text, returning the cleaned text. */
export function extractUsage(text: string): { text: string; usage: TokenUsage | null } {
  const m = text.match(MARKER_RE);
  if (!m) return { text, usage: null };
  let usage: TokenUsage | null = null;
  try {
    const parsed = JSON.parse(m[1]) as Partial<TokenUsage>;
    usage = {
      inputTokens: Number(parsed.inputTokens ?? 0),
      outputTokens: Number(parsed.outputTokens ?? 0),
    };
  } catch {
    /* malformed marker — ignore, just strip it */
  }
  return { text: text.replace(MARKER_RE, ""), usage };
}

/** Total tokens for display. */
export function totalTokens(u: TokenUsage): number {
  return u.inputTokens + u.outputTokens;
}
