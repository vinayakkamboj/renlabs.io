/**
 * POST /api/agents/run  — execute one autonomous agent run.
 *
 * Body: { agentId: string, taskId?: string }
 *
 * A run makes multiple model calls (build + repair + reflection), so it needs a
 * generous execution budget. Auth and RLS are enforced inside runAgentTask via
 * the cookie-based Supabase client — the body never carries identity.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { runAgentTask } from "@/lib/actions/agent-runner";

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

  const result = await runAgentTask(body.agentId, body.taskId);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
