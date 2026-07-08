/**
 * POST /api/agents/tick — the in-app ambient scheduler tick.
 *
 * The workspace pings this every minute while it's open (and immediately when
 * a loop is switched on). It claims the signed-in user's due loop-enabled
 * agents and runs one cycle each via after() — the response returns instantly
 * and the cycles execute in the background of this invocation.
 *
 * Why this exists alongside /api/cron/agents: Vercel's Hobby plan only allows
 * a daily cron, which is useless for a working loop. This user-scoped tick
 * needs no secret and no cron — as long as anyone has the app open, their
 * loops advance on time. The platform cron then covers the fully-closed-tab
 * case (daily on Hobby, every few minutes on Pro).
 *
 * Overlap safety: shares the same conditional CLAIM as the cron, so a cron
 * tick, another tab, and this tick can never run the same agent twice.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { after } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { claimDueAgents, runClaimedAgents } from "@/lib/actions/agent-scheduler";
import { isEmailAllowed } from "@/lib/auth/allowlist";

// One user's tick advances at most this many agents per minute — plenty for a
// starter team, and it bounds how much work one invocation takes on.
const MAX_AGENTS_PER_TICK = 3;

export async function POST() {
  if (!isSupabaseConfigured()) {
    return Response.json({ ticked: 0, reason: "supabase_not_configured" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!isEmailAllowed(user.email)) {
    return Response.json({ error: "private_beta" }, { status: 403 });
  }

  const claimed = await claimDueAgents({ userId: user.id, limit: MAX_AGENTS_PER_TICK });
  if (!claimed.length) return Response.json({ ticked: 0 });

  // Cycles are multi-minute model calls — run them after the response so the
  // UI's ping returns instantly. Progress lands in reports/activity/ren-branch
  // files, which the Agents view already polls.
  const requesterId = user.id;
  after(async () => {
    await runClaimedAgents(claimed, requesterId);
  });

  return Response.json({
    ticked: claimed.length,
    agents: claimed.map((a) => a.name),
  });
}
