/**
 * GET /api/cron/agents — the platform-wide ambient agent scheduler tick.
 *
 * Invoked on a schedule (see vercel.json). Claims every agent whose loop is
 * enabled and whose burn-rate clock says it's due (next_run_at <= now), runs
 * one cycle each, and lets each agent's own throttle (rate_tokens_per_min,
 * applied inside runAgentTask) set its *next* next_run_at. The cron's own
 * frequency is just "how often we check" — per-agent pacing lives on the
 * agent row, not in the schedule.
 *
 * NOTE on cadence: vercel.json ships a DAILY schedule because that's the most
 * Vercel's Hobby plan allows (a tighter schedule blocks the whole deploy).
 * Near-real-time pacing comes from /api/agents/tick, which the workspace pings
 * every minute while it's open. On Vercel Pro, tighten vercel.json to
 * "*\/5 * * * *" and this cron carries loops even with every tab closed.
 *
 * Overlap safety: agents are CLAIMED (conditional next_run_at push) before
 * running, so an overlapping tick can never run the same agent twice.
 *
 * Auth: requires CRON_SECRET as a Bearer token (Vercel's cron dispatcher sends
 * it automatically when the env var is set; use the same header to trigger a
 * tick manually for testing).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 280;

import { NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { claimDueAgents, runClaimedAgents } from "@/lib/actions/agent-scheduler";

// Bound how many agents one tick advances — keeps each cron invocation well
// inside its time limit regardless of how many loops exist. Anything left
// over is still due and gets picked up by the next tick.
const MAX_AGENTS_PER_TICK = 5;

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

  const claimed = await claimDueAgents({ limit: MAX_AGENTS_PER_TICK });
  if (!claimed.length) return Response.json({ ran: 0 });

  const results = await runClaimedAgents(claimed);
  return Response.json({ ran: results.length, results });
}
