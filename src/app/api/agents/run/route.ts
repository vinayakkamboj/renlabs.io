/**
 * POST /api/agents/run — execute one autonomous agent run.
 *
 * Body: { agentId: string, taskId?: string }
 *
 * A run makes multiple model calls (build + repair + reflection), so it needs a
 * generous execution budget. Auth and RLS are enforced inside runAgentTask via
 * the admin Supabase client (which checks ownership via the project's user_id).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { runAgentTask } from "@/lib/actions/agent-runner";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";

export async function POST(req: NextRequest) {
  let body: { agentId?: string; taskId?: string };
  try {
    body = (await req.json()) as { agentId?: string; taskId?: string };
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!body.agentId || typeof body.agentId !== "string") {
    return Response.json({ ok: false, error: "agentId is required." }, { status: 400 });
  }

  // Authenticate the requester — runs spend the owner's Ren credits, so only the
  // signed-in owner may trigger them (verified against the agent's user_id).
  let requesterId: string | undefined;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ ok: false, error: "Sign in to run agents." }, { status: 401 });
    }
    if (!isEmailAllowed(user.email)) {
      return Response.json(
        { ok: false, error: "Ren is in private beta — your account isn't on the allowlist yet." },
        { status: 403 },
      );
    }
    requesterId = user.id;
  }

  const result = await runAgentTask(body.agentId, body.taskId, requesterId);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
