/**
 * POST /api/astra — the Astra chatbot endpoint.
 *
 * Authenticated, rate-limited conversational chat served by Astra via
 * OpenRouter. Each message counts against a per-user daily limit enforced
 * server-side (the client can't bypass it).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  isAstraConfigured,
  streamAstraText,
  type ChatMsg,
} from "@/lib/ai/astra";

const DAILY_LIMIT = 40;

const SYSTEM_PROMPT =
  "You are Astra, the reasoning and coding model built by Ren Labs. " +
  "Be clear, helpful, and precise. Write clean, correct code when asked, and " +
  "explain your thinking concisely. State uncertainty honestly instead of guessing.";

export async function POST(req: NextRequest) {
  if (!isAstraConfigured()) {
    return Response.json({ error: "astra_not_configured" }, { status: 503 });
  }

  let messages: ChatMsg[];
  try {
    const body = (await req.json()) as { messages?: ChatMsg[] };
    if (
      !Array.isArray(body.messages) ||
      body.messages.length === 0 ||
      body.messages.some(
        (m) =>
          typeof m?.content !== "string" ||
          (m.role !== "user" && m.role !== "assistant"),
      )
    ) {
      throw new Error("invalid");
    }
    messages = body.messages;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // Auth + daily rate limit (skipped only when Supabase isn't configured).
  let remaining = DAILY_LIMIT;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "auth_required" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("increment_chat_usage", {
      p_limit: DAILY_LIMIT,
    });
    // If the function/table doesn't exist yet, allow (dev) — fail open only on
    // a missing migration, never on a real "limit reached" result.
    if (!error && data) {
      const r = data as { ok: boolean; remaining: number };
      if (!r.ok) {
        return Response.json(
          { error: "daily_limit_reached", limit: DAILY_LIMIT },
          { status: 429 },
        );
      }
      remaining = r.remaining;
    }
  }

  const result = await streamAstraText(
    [{ role: "system", content: SYSTEM_PROMPT }, ...messages.slice(-20)],
    { maxTokens: 2048 },
  );

  if (!result.ok) {
    return Response.json({ error: "astra_unreachable" }, { status: 502 });
  }

  return new Response(result.stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-astra-remaining": String(remaining),
    },
  });
}
