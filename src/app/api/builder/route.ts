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
import {
  buildRepositoryIntelligence,
  formatIntelligenceForPrompt,
} from "@/lib/ai/repository-intelligence";
import { isAstraConfigured, streamAstraText } from "@/lib/ai/astra";
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
  /** Image data URLs attached to the latest user message (vision-capable providers). */
  images?: string[];
}

// Generous ceiling so multi-file builds finish without truncating mid-file.
// (If a response still gets cut off, the parser drops the incomplete file and
// the build loop repairs it — but more headroom means that rarely fires.)
const MAX_OUTPUT_TOKENS = 32_000;

export async function POST(req: NextRequest) {
  if (!isAstraConfigured()) {
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

  // Credit figures surfaced to the client via response headers (known before we
  // start streaming). The cost is fixed per tier; the balance is post-deduction.
  let creditsDeducted = CREDITS_PER_BUILD[tier.id as ModelTierId];
  let creditsBalance: number | null = null;

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

    // Everyone — including admins — goes through the metered gate. Admins top
    // up their own balance from the admin panel (Users → Grant credits) rather
    // than building for free, so testing usage is always accounted for.
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
    if (!("skipped" in deduct)) {
      creditsBalance = deduct.balance;
      creditsDeducted = deduct.deducted;
    }
  }

  // ── 3. Build the prompt and context pack ──────────────────────────────────
  const files = Array.isArray(body.projectFiles) ? body.projectFiles : [];
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const contextPack = buildContextPack(files, lastUser?.content ?? "", {
    recentlyChanged: body.recentlyChanged,
    errorPaths: body.errorPaths,
  });

  const isRepo = body.isRepository === true;

  // For imported repositories, give Astra a deep, structured understanding of
  // the codebase: detected stack + run commands, plus a full intelligence map
  // (architecture scope, entrypoints, file breakdown, and risks).
  const repoSystem = () => {
    const stackPrompt = buildRepoImportPrompt(detectRepoStack(files));
    const intel = buildRepositoryIntelligence(files.map((f) => f.path));
    return `${stackPrompt}\n\n${formatIntelligenceForPrompt(intel)}`;
  };

  const system = body.repairIssues
    ? buildRepairPrompt(body.repairIssues)
    : isRepo
      ? repoSystem()
      : body.isFirstBuild
        ? buildNewProjectPrompt()
        : buildEditPrompt();

  const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
  const apiMessages = body.messages.map((m, idx) => {
    if (idx === body.messages.length - 1 && m.role === "user") {
      return {
        role: "user" as const,
        content: `${contextPack}\n\n---\n\n## Request\n${m.content}`,
        images: images.length ? images : undefined,
      };
    }
    return { role: m.role, content: m.content };
  });

  // ── 4. Stream from Astra (OpenRouter, or Claude fallback) ─────────────────
  const result = await streamAstraText(
    [
      { role: "system", content: system },
      ...apiMessages.slice(-16),
    ],
    { maxTokens: MAX_OUTPUT_TOKENS },
  );

  if (!result.ok) {
    return Response.json(
      { error: "upstream_error", detail: result.detail },
      { status: result.status },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "x-ren-tier": tier.id,
    "x-ren-credits-deducted": String(creditsDeducted),
  };
  if (creditsBalance !== null) {
    headers["x-ren-credits-balance"] = String(creditsBalance);
  }

  return new Response(result.stream, { headers });
}
