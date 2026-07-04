/**
 * Ambient agent scheduling — shared by the cron tick (/api/cron/agents) and
 * the in-app tick (/api/agents/tick). NEVER import from a client component.
 *
 * The core problem this solves: two ticks can overlap (cron firing while a
 * user-tick is mid-run, or two tabs ticking at once). Without a claim step,
 * both would select the same due agent and run it twice concurrently —
 * double model calls, double credit charges. So before running anything we
 * CLAIM each due agent with a conditional update that pushes next_run_at
 * forward; the condition means only one caller's update matches, and the
 * losers simply skip. runAgentTask then overwrites next_run_at with the real
 * burn-rate schedule when the cycle finishes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { runAgentTask } from "./agent-runner";

/** How far a claim pushes next_run_at. Generous enough to cover a slow cycle;
 *  overwritten by the real throttle schedule when the cycle completes, and by
 *  the +5min backoff on failure — so a crashed cycle self-heals after this. */
const CLAIM_WINDOW_MS = 10 * 60_000;

export interface ClaimedAgent {
  id: string;
  name: string;
}

/**
 * Atomically claim up to `limit` due loop-enabled agents (optionally scoped to
 * one owner). Returns only the agents THIS caller won — safe to run.
 */
export async function claimDueAgents(opts: {
  userId?: string;
  limit: number;
}): Promise<ClaimedAgent[]> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const claimIso = new Date(Date.now() + CLAIM_WINDOW_MS).toISOString();

  let query = supabase
    .from("agents")
    .select("id, name")
    .eq("loop_enabled", true)
    .neq("status", "paused")
    .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
    .limit(opts.limit);
  if (opts.userId) query = query.eq("user_id", opts.userId);

  const { data: due } = await query;
  if (!due?.length) return [];

  const claimed: ClaimedAgent[] = [];
  for (const agent of due) {
    // Conditional claim: only succeeds if the agent is STILL due — a
    // concurrent tick that got here first already moved next_run_at, so our
    // update matches zero rows and we skip it.
    let claim = supabase
      .from("agents")
      .update({ next_run_at: claimIso })
      .eq("id", agent.id)
      .eq("loop_enabled", true)
      .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);
    if (opts.userId) claim = claim.eq("user_id", opts.userId);
    const { data: won } = await claim.select("id");
    if (won?.length) claimed.push(agent);
  }
  return claimed;
}

export interface TickResult {
  agentId: string;
  name: string;
  ok: boolean;
  error?: string;
}

/** Run one ambient cycle for each claimed agent, sequentially (bounds load —
 *  each cycle is a multi-minute model call; parallel fan-out of many would
 *  blow the invocation's time limit unpredictably). */
export async function runClaimedAgents(
  claimed: ClaimedAgent[],
  requesterId?: string,
): Promise<TickResult[]> {
  const results: TickResult[] = [];
  for (const agent of claimed) {
    try {
      const r = await runAgentTask(agent.id, undefined, requesterId);
      results.push({ agentId: agent.id, name: agent.name, ok: r.ok, error: r.error });
    } catch (e) {
      results.push({
        agentId: agent.id,
        name: agent.name,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
