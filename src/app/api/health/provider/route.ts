/**
 * GET /api/health/provider
 *
 * Diagnostic: reports which inference provider Astra will actually use, the
 * resolved model id, and (unless ?ping=0) does a tiny live generation against
 * the active provider to confirm it really responds. Use this to verify a build
 * is routed to GLM via Fireworks — not silently falling back to Claude.
 *
 *   { activeProvider, model, fireworksConfigured, anthropicConfigured,
 *     ping: { ok, servedBy, sample, detail } }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import {
  isFireworksConfigured,
  fireworksModelId,
} from "@/lib/ai/fireworks";
import { isAnthropicConfigured, anthropicModelId } from "@/lib/ai/anthropic";
import { activeProvider, streamAstraText } from "@/lib/ai/astra";

export async function GET(req: NextRequest) {
  const fireworks = isFireworksConfigured();
  const anthropic = isAnthropicConfigured();
  const provider = activeProvider();
  const model = fireworks
    ? fireworksModelId()
    : anthropic
      ? anthropicModelId()
      : null;

  const base = {
    activeProvider: provider,
    model,
    fireworksConfigured: fireworks,
    anthropicConfigured: anthropic,
  };

  // Skip the live call with ?ping=0 (just report config).
  if (new URL(req.url).searchParams.get("ping") === "0" || !provider) {
    return Response.json({ ...base, ping: { skipped: true } });
  }

  // Tiny live generation to prove the active provider actually answers.
  const result = await streamAstraText(
    [{ role: "user", content: "Reply with exactly: GLM_OK" }],
    { maxTokens: 16, reasoningEffort: "high" },
  );

  if (!result.ok) {
    return Response.json({
      ...base,
      ping: { ok: false, detail: `${result.status}: ${result.detail}` },
    });
  }

  // Drain the small stream to a string.
  const reader = result.stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) text += decoder.decode(value, { stream: true });
    }
  } catch {
    /* ignore */
  }

  return Response.json({
    ...base,
    ping: {
      ok: true,
      servedBy: result.provider, // which provider ACTUALLY served (after any failover)
      sample: text.replace(/[].*$/s, "").trim().slice(0, 60),
    },
  });
}
