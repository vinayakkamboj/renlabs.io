/**
 * POST /api/builder/jobs — start a background build job.
 * GET  /api/builder/jobs?projectId=… — latest job for a project (resume/poll).
 *
 * The job runs server-side via `after()` — it keeps executing after this
 * response returns, so the build survives the user closing the browser. The
 * client polls GET for the live activity feed and completion.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { after } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireBuildBalance } from "@/lib/credits/server";
import { runBuildStep } from "@/lib/builder/job-runner";
import { isUserAllowed } from "@/lib/auth/access";

interface CreateJobRequest {
  projectId?: string;
  prompt?: string;
  messages?: { role: "user" | "assistant"; content: string }[];
  isFirstBuild?: boolean;
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    // No database — background jobs unavailable; client falls back to streaming.
    return Response.json({ error: "jobs_unavailable" }, { status: 503 });
  }

  let body: CreateJobRequest;
  try {
    body = (await req.json()) as CreateJobRequest;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.projectId || !body.prompt?.trim()) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!(await isUserAllowed(supabase, user.id, user.email))) {
    return Response.json({ error: "private_beta" }, { status: 403 });
  }

  // ── Idempotency guard ──────────────────────────────────────────────────────
  // One live build per project. If a job is already running (e.g. the user
  // reloaded and resent, or double-clicked), reattach to it instead of
  // creating — and charging for — a duplicate. Runs BEFORE the credit gate so
  // a reattach never costs credits. A job whose heartbeat has been silent for
  // 2.5+ minutes is dead — mark it failed and allow a fresh build.
  const ACTIVE_STATUSES = ["queued", "thinking", "writing", "verifying", "repairing", "applying"];
  const { data: existing } = await supabase
    .from("build_jobs")
    .select("id, status, updated_at")
    .eq("project_id", body.projectId)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const silentMs = existing.updated_at
      ? Date.now() - new Date(existing.updated_at).getTime()
      : Infinity;
    if (silentMs < 150_000) {
      return Response.json({
        ok: true,
        jobId: existing.id,
        existing: true,
        creditsDeducted: 0,
        creditsBalance: null,
      });
    }
    await supabase
      .from("build_jobs")
      .update({ status: "error", error: "Build worker went silent.", completed_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  // Usage-based billing: starting a build needs a POSITIVE balance; each pass
  // then charges the credits its ACTUAL token usage costs (chargeUsage in the
  // job runner). No flat fee up front — users pay for what the task consumed.
  const gate = await requireBuildBalance(user.id);
  if (!gate.ok) {
    return Response.json(
      { error: "insufficient_credits", balance: gate.balance },
      { status: 402 },
    );
  }
  const creditsDeducted = 0;
  const creditsBalance = gate.balance;

  const { data: jobRow, error } = await supabase
    .from("build_jobs")
    .insert({
      user_id: user.id,
      project_id: body.projectId,
      prompt: body.prompt.trim(),
      messages: (body.messages ?? []).slice(-16),
      is_first_build: body.isFirstBuild === true,
      credits_deducted: creditsDeducted,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !jobRow) {
    // Table missing (migration not applied) — tell the client to fall back.
    return Response.json({ error: "jobs_unavailable" }, { status: 503 });
  }

  // Run the FIRST pass after the response is sent; each pass chains the next
  // as a fresh invocation, so no single function run approaches the platform
  // time limit no matter how large the build is.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  after(async () => {
    await runBuildStep(jobRow.id, origin);
  });

  return Response.json({
    ok: true,
    jobId: jobRow.id,
    creditsDeducted,
    creditsBalance,
  });
}

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return Response.json({ job: null });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ job: null });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const { data } = await supabase
    .from("build_jobs")
    .select(
      "id, status, steps, result_summary, changed_paths, error, prompt, created_at, updated_at, completed_at, input_tokens, output_tokens, credits_deducted",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({ job: data ?? null });
}
