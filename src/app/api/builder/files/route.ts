/**
 * POST /api/builder/files  — persist a project's files (best-effort)
 * GET  /api/builder/files?projectId=… — load a project's files
 *
 * Files are upserted into a `project_files` table when Supabase is configured
 * and the table exists. Both handlers degrade gracefully: the client treats the
 * server as a best-effort sync layer on top of localStorage, so a missing table
 * or unconfigured Supabase never breaks the workspace.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProjectFile } from "@/lib/builder/types";

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return Response.json({ files: [] });
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ files: [] });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ files: [] });

    // Access is enforced by RLS (owner or accepted collaborator); no user_id
    // filter so collaborators load the shared project's files too.
    const { data } = await supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", projectId);

    return Response.json({ files: (data ?? []) as ProjectFile[] });
  } catch {
    return Response.json({ files: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return Response.json({ ok: true });

  let body: { projectId?: string; files?: ProjectFile[] };
  try {
    body = (await req.json()) as { projectId?: string; files?: ProjectFile[] };
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!body.projectId || !Array.isArray(body.files)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ ok: true });

    const rows = body.files.map((f) => ({
      project_id: body.projectId,
      user_id: user.id,
      path: f.path,
      content: f.content,
    }));

    await supabase
      .from("project_files")
      .upsert(rows, { onConflict: "project_id,path" });

    return Response.json({ ok: true });
  } catch {
    // Table may not exist yet — non-fatal.
    return Response.json({ ok: true });
  }
}
