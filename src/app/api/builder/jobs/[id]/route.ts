/**
 * GET   /api/builder/jobs/:id — poll one job's status + live activity feed.
 * PATCH /api/builder/jobs/:id — request cancellation ({ cancel: true }).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!isSupabaseConfigured()) return Response.json({ job: null });
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const { data } = await supabase
    .from("build_jobs")
    .select(
      "id, status, steps, result_summary, changed_paths, error, created_at, completed_at, input_tokens, output_tokens, credits_deducted",
    )
    .eq("id", id)
    .maybeSingle();

  return Response.json({ job: data ?? null });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isSupabaseConfigured()) return Response.json({ ok: false }, { status: 503 });
  const { id } = await params;

  let cancel = false;
  try {
    cancel = Boolean(((await req.json()) as { cancel?: boolean }).cancel);
  } catch {
    /* body optional */
  }
  if (!cancel) return Response.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  // RLS restricts this to the owner's rows.
  await supabase.from("build_jobs").update({ cancelled: true }).eq("id", id);
  return Response.json({ ok: true });
}
