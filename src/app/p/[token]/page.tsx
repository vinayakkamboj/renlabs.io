/**
 * /p/[token] — PUBLIC live preview of a project.
 *
 * Anyone with the link sees the built app running — no account, no sign-in.
 * The token is an unguessable per-share secret minted by the project owner;
 * lookups go through the service-role client because the viewer is anonymous
 * (RLS has no session to evaluate). Always dynamic: the preview shows the
 * project's CURRENT main-branch files, so the link stays fresh as the owner
 * keeps building.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProjectFile } from "@/lib/builder/types";
import { PublicPreviewViewer } from "./viewer";

interface Params {
  params: Promise<{ token: string }>;
}

interface LoadedPreview {
  projectName: string;
  files: ProjectFile[];
}

async function loadPreview(token: string): Promise<LoadedPreview | null> {
  if (!isSupabaseConfigured() || !/^[A-Za-z0-9_-]{10,64}$/.test(token)) {
    return null;
  }
  try {
    const supabase = createAdminClient();

    const { data: link } = await supabase
      .from("preview_links")
      .select("project_id, revoked")
      .eq("token", token)
      .maybeSingle();
    if (!link || link.revoked) return null;

    const [{ data: project }, { data: files }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", link.project_id).maybeSingle(),
      supabase
        .from("project_files")
        .select("path, content")
        .eq("project_id", link.project_id)
        .eq("branch", "main")
        .order("path"),
    ]);

    if (!files?.length) return null;
    return {
      projectName: (project?.name as string) || "Untitled project",
      files: files as ProjectFile[],
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const preview = await loadPreview(token);
  return {
    title: preview ? `${preview.projectName} — Ren preview` : "Preview — Ren",
    robots: { index: false, follow: false },
  };
}

export default async function PublicPreviewPage({ params }: Params) {
  const { token } = await params;
  const preview = await loadPreview(token);

  if (!preview) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-carbon px-6 text-center">
        <p className="text-[17px] font-medium text-dusk">
          This preview link doesn&apos;t exist or was turned off.
        </p>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-dusk-faint">
          Ask whoever sent it to share a fresh link from their Ren workspace.
        </p>
      </div>
    );
  }

  return (
    <PublicPreviewViewer
      projectName={preview.projectName}
      files={preview.files}
    />
  );
}
