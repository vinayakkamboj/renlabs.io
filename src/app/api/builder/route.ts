/**
 * POST /api/builder
 *
 * Core build endpoint. Validates credits, streams the Anthropic response, and
 * deducts credits atomically on success. All credit operations are server-side
 * — the client never controls or can bypass the balance.
 *
 * Security model:
 *  1. Session is read from the HTTP-only cookie (never from request body).
 *  2. Credit cost is looked up from the server-side config, not from the client.
 *  3. Deduction uses a Supabase RPC that holds a row lock — no double-spend.
 *  4. If Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL missing), the
 *     gate is skipped so local development works without a migration.
 *  5. Returns 402 when the user has insufficient credits.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { resolveModelTier } from "@/lib/builder/model-tiers";
import { buildContextPack } from "@/lib/builder/context";
import {
  buildNewProjectPrompt,
  buildEditPrompt,
  buildRepairPrompt,
  buildRepoImportPrompt,
} from "@/lib/builder/prompts";
import { detectRepoStack } from "@/lib/builder/repo-stack";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { deductBuildCredits } from "@/lib/credits/server";
import { CREDITS_PER_BUILD } from "@/lib/credits/config";
import type { ProjectFile } from "@/lib/builder/types";
import type { ModelTierId } from "@/lib/builder/model-tiers";

interface BuildRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  projectFiles: ProjectFile[];
  modelTier?: string;
  projectId?: string;
  isFirstBuild?: boolean;
  isRepository?: boolean;
  recentlyChanged?: string[];
  errorPaths?: string[];
  repairIssues?: string;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_OUTPUT_TOKENS = 16_000;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "builder_not_configured" }, { status: 503 });
  }

  // ── 1. Parse and validate the request body ──────────────────────────────
  let body: BuildRequest;
  try {
    body = (await req.json()) as BuildRequest;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new Error("invalid");
    }
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const tier = resolveModelTier(body.modelTier);
  const projectId = body.projectId ?? "unknown";

  // ── 2. Credit gate ────────────────────────────────────────────────────────
  // Authenticate the request server-side. Never trust client-reported user id.
  if (isSupabaseConfigured()) {
    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // Auth client error → deny to be safe in production
      return Response.json({ error: "auth_required" }, { status: 401 });
    }

    if (!userId) {
      return Response.json({ error: "auth_required" }, { status: 401 });
    }

    // Deduct credits atomically before hitting Anthropic.
    const deduct = await deductBuildCredits(userId, tier.id as ModelTierId, projectId);

    if (!deduct.ok) {
      if (deduct.error === "insufficient_credits") {
        return Response.json(
          {
            error: "insufficient_credits",
            cost: CREDITS_PER_BUILD[tier.id as ModelTierId],
          },
          { status: 402 },
        );
      }
      // Other DB error — fail closed to prevent unbounded API calls.
      return Response.json({ error: "credit_check_failed" }, { status: 500 });
    }
    // deduct.skipped === true means the credits table doesn't exist yet (dev).
  }

  // ── 3. Build the prompt and context pack ──────────────────────────────────
  const files = Array.isArray(body.projectFiles) ? body.projectFiles : [];
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const contextPack = buildContextPack(files, lastUser?.content ?? "", {
    recentlyChanged: body.recentlyChanged,
    errorPaths: body.errorPaths,
  });

  const isRepo = body.isRepository === true;
  const system = body.repairIssues
    ? buildRepairPrompt(body.repairIssues)
    : isRepo
      ? buildRepoImportPrompt(detectRepoStack(files))
      : body.isFirstBuild
        ? buildNewProjectPrompt()
        : buildEditPrompt();

  const apiMessages = body.messages.map((m, idx) => {
    if (idx === body.messages.length - 1 && m.role === "user") {
      return {
        role: "user" as const,
        content: `${contextPack}\n\n---\n\n## Request\n${m.content}`,
      };
    }
    return { role: m.role, content: m.content };
  });

  // ── 4. Stream from Anthropic ──────────────────────────────────────────────
  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: tier.modelId,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: apiMessages.slice(-16),
      stream: true,
    }),
  }).catch(() => null);

  if (!upstream || !upstream.ok || !upstream.body) {
    const detail = upstream ? await upstream.text().catch(() => "") : "";
    return Response.json(
      { error: "upstream_error", detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = upstream.body.pipeThrough(
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
            // Partial JSON across chunk boundary — wait for more.
          }
        }
      },
    }),
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-ren-tier": tier.id,
    },
  });
}
