/**
 * GET /api/cron/agents — the ambient agent scheduler tick.
 *
 * Invoked on a schedule (see vercel.json). Finds every agent whose loop is
 * enabled and whose burn-rate clock says it's due (next_run_at <= now), runs
 * one cycle each via runAgentTask, and lets each agent's own throttle
 * (rate_tokens_per_min, applied inside runAgentTask) set its *next* next_run_at.
 * The cron's own frequency is just "how often we check" — the actual pacing
 * per agent lives on the agent row, not in the schedule.
 *
 * Auth: requires CRON_SECRET as a Bearer token (Vercel's cron dispatcher sends
 * this automatically when the env var is set; call manually with the same
 * header to trigger a tick for testing).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 280;

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { runAgentTask } from "@/lib/actions/agent-runner";

// Bound how many agents one tick advances — keeps each cron invocation well
// inside its time limit regardless of how many loops exist.
const MAX_AGENTS_PER_TICK = 10;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (!isSupabaseConfigured()) {
    return Response.json({ ran: 0, reason: "supabase_not_configured" });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await supabase
    .from("agents")
    .select("id, name")
    .eq("loop_enabled", true)
    .neq("status", "paused")
    .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
    .limit(MAX_AGENTS_PER_TICK);

  if (!due?.length) {
    return Response.json({ ran: 0 });
  }

  const results = await Promise.allSettled(
    due.map((a) => runAgentTask(a.id)),
  );

  const summary = due.map((a, i) => {
    const r = results[i];
    if (r.status === "fulfilled") {
      return { agentId: a.id, name: a.name, ok: r.value.ok, error: r.value.error };
    }
    return { agentId: a.id, name: a.name, ok: false, error: String(r.reason) };
  });

  return Response.json({ ran: summary.length, results: summary });
}
