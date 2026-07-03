/**
 * POST /api/builder/jobs/step — run ONE pass of a build job, then chain.
 *
 * Each invocation stays far below the platform's function time limit; long
 * builds are a chain of these instead of one long-running worker. Returns 202
 * immediately and executes the pass via after(). The runner itself validates
 * the job (exists, active, not locked), so a stray or replayed call is a no-op.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { after } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { runBuildStep } from "@/lib/builder/job-runner";

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ ok: false }, { status: 503 });
  }

  let jobId: string | undefined;
  try {
    jobId = ((await req.json()) as { jobId?: string }).jobId;
  } catch {
    /* fall through */
  }
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;

  const id = jobId;
  after(async () => {
    await runBuildStep(id, origin);
  });

  return Response.json({ ok: true }, { status: 202 });
}
