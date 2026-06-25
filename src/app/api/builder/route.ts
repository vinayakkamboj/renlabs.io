/**
 * POST /api/builder
 *
 * Core build endpoint. Validates credits, streams the Astra response (Fireworks
 * primary, Claude fallback), and deducts credits atomically on success. All
 * credit operations are server-side
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
// Allow the orchestrated build (design phase + build phase) the headroom it
// needs on Vercel. Capped by the plan's actual limit, so this is a ceiling.
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { resolveModelTier } from "@/lib/builder/model-tiers";
import { buildContextPack } from "@/lib/builder/context";
import {
  buildNewProjectPrompt,
  buildEditPrompt,
  buildRepairPrompt,
  buildRepoImportPrompt,
  buildArchitectPrompt,
} from "@/lib/builder/prompts";
import { detectRepoStack } from "@/lib/builder/repo-stack";
import {
  buildRepositoryIntelligence,
  formatIntelligenceForPrompt,
} from "@/lib/ai/repository-intelligence";
import { isAstraConfigured, streamAstraText } from "@/lib/ai/astra";
import {
  PLAN_BEGIN_MARKER,
  PLAN_DONE_MARKER,
  extractUsage,
} from "@/lib/ai/usage";
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

// Hard ceiling on the design-phase plan. Kept tight so planning leaves the build
// phase as much of the function's time budget as possible (a long plan on a
// timeout-limited host is what truncates big multi-file builds mid-stream).
const PLAN_TIMEOUT_MS = 15_000;

/**
 * Model used for the quick design-phase plan. Defaults to a lighter, faster
 * model than the main builder so planning returns quickly; falls back to the
 * main Fireworks model when no dedicated planning model is configured.
 *   FIREWORKS_PLANNING_MODEL   e.g. accounts/fireworks/models/glm-4p6
 */
function planningModelId(): string | undefined {
  return process.env.FIREWORKS_PLANNING_MODEL || undefined;
}

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

  // System prompt for the build engineer. When a design phase runs, the locked
  // plan is injected into this prompt instead (built inside the stream below).
  const baseSystem = body.repairIssues
    ? buildRepairPrompt(body.repairIssues)
    : isRepo
      ? repoSystem()
      : body.isFirstBuild
        ? buildNewProjectPrompt()
        : buildEditPrompt();

  const buildMessages = (sys: string) => [
    { role: "system" as const, content: sys },
    ...apiMessages.slice(-16),
  ];

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "x-ren-tier": tier.id,
    "x-ren-credits-deducted": String(creditsDeducted),
  };
  if (creditsBalance !== null) {
    headers["x-ren-credits-balance"] = String(creditsBalance);
  }

  // ── 4. Orchestrated stream (design phase → build phase) ───────────────────
  // When the design phase is on (ASTRA_DESIGN_PHASE !== "0"), a fresh build is a
  // single streamed response with two visible stages:
  //   1. Architecture plan — streamed LIVE between PLAN_BEGIN/PLAN_DONE markers
  //      so the user watches Astra design the app (no silent "stuck" wait).
  //   2. Build — the engineer implements the locked plan, streamed after the
  //      divider. Planning is time-boxed; if it stalls or errors we build anyway.
  // reasoning_effort=low keeps GLM 5.2 emitting fast instead of reasoning
  // silently (its reasoning tokens are not surfaced to the client).
  // Whether the project already has a real app (pages/components beyond the
  // blank template). If so we ALWAYS edit directly — the design phase is only for
  // a genuinely fresh project's first build, so an existing project (e.g. one
  // whose first build didn't persist server-side) can still be coded on anytime.
  const hasExistingApp = files.some(
    (f) =>
      f.path.startsWith("src/pages/") || f.path.startsWith("src/components/"),
  );

  const designPhase =
    process.env.ASTRA_DESIGN_PHASE !== "0" &&
    body.isFirstBuild === true &&
    !hasExistingApp &&
    !isRepo &&
    !body.repairIssues &&
    Boolean(lastUser?.content?.trim());

  if (!designPhase) {
    const result = await streamAstraText(buildMessages(baseSystem), {
      maxTokens: MAX_OUTPUT_TOKENS,
      reasoningEffort: "low",
    });
    if (!result.ok) {
      return Response.json(
        { error: "upstream_error", detail: result.detail },
        { status: result.status },
      );
    }
    headers["x-ren-planned"] = "0";
    return new Response(result.stream, { headers });
  }

  headers["x-ren-planned"] = "1";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const request = lastUser!.content.trim();

  const combined = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 1. Live architecture plan (time-boxed, best-effort).
      controller.enqueue(encoder.encode(PLAN_BEGIN_MARKER));
      let planRaw = "";
      try {
        const planRes = await streamAstraText(
          [
            { role: "system", content: buildArchitectPrompt() },
            { role: "user", content: `## Request\n${request}` },
          ],
          {
            maxTokens: 1200,
            model: planningModelId(),
            reasoningEffort: "low",
            signal: AbortSignal.timeout(PLAN_TIMEOUT_MS),
          },
        );
        if (planRes.ok) {
          const reader = planRes.stream.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              planRaw += decoder.decode(value, { stream: true });
              controller.enqueue(value);
            }
          }
        }
      } catch {
        // Planning is best-effort — a timeout/error just means we build directly.
      }

      // 2. Lock the plan and signal the build phase.
      const plan = extractUsage(planRaw).text.trim();
      controller.enqueue(encoder.encode(PLAN_DONE_MARKER));

      // 3. Build the app, implementing the locked plan when we have one.
      const sys = plan.length > 80 ? buildNewProjectPrompt(plan) : baseSystem;
      const buildRes = await streamAstraText(buildMessages(sys), {
        maxTokens: MAX_OUTPUT_TOKENS,
        reasoningEffort: "low",
      });
      if (!buildRes.ok) {
        controller.enqueue(
          encoder.encode(
            `The build couldn't be completed. (${buildRes.status}: ${buildRes.detail})`,
          ),
        );
        controller.close();
        return;
      }
      const reader = buildRes.stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) controller.enqueue(value);
      }
      controller.close();
    },
  });

  return new Response(combined, { headers });
}
