import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { readGitHubSession } from "@/lib/github/session";
import { loadRepositoryFiles } from "@/lib/builder/github-loader";
import { createBaseTemplate } from "@/lib/builder/base-template";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { ProjectFile } from "@/lib/builder/types";

export const metadata: Metadata = { title: "Workspace" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface RepoJoin {
  full_name: string;
  default_branch: string;
}

export default async function WorkspacePage({ params }: PageProps) {
  const { id } = await params;

  // Without Supabase, still render a usable workspace seeded from the template.
  if (!isSupabaseConfigured()) {
    return (
      <WorkspaceShell
        projectId={id}
        projectName="Untitled project"
        repoFullName={null}
        repoDefaultBranch={null}
        initialFiles={createBaseTemplate()}
        hadFirstBuild={false}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, kind, repository_id, repositories ( full_name, default_branch )",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) redirect("/dashboard/projects");

  const repoRaw = project.repositories as unknown;
  const repo: RepoJoin | null = Array.isArray(repoRaw)
    ? ((repoRaw[0] as RepoJoin | undefined) ?? null)
    : ((repoRaw as RepoJoin | null) ?? null);

  // Resolve the initial file set: existing saved files → repo files → template.
  let initialFiles: ProjectFile[] = [];
  let hadFirstBuild = false;

  try {
    const { data: saved } = await supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", id)
      .eq("user_id", user.id);
    if (saved && saved.length) {
      initialFiles = saved as ProjectFile[];
      hadFirstBuild = true;
    }
  } catch {
    /* table may not exist — fall through */
  }

  if (!initialFiles.length && project.kind === "repository" && repo) {
    const cookieStore = await cookies();
    const session = readGitHubSession(cookieStore);
    if (session) {
      const repoFiles = await loadRepositoryFiles(
        repo.full_name,
        repo.default_branch,
        session.accessToken,
      );
      if (repoFiles.length) {
        initialFiles = repoFiles;
        hadFirstBuild = true; // an existing repo is not a blank first build
      }
    }
  }

  if (!initialFiles.length) {
    initialFiles = createBaseTemplate();
  }

  return (
    <WorkspaceShell
      projectId={id}
      projectName={project.name}
      repoFullName={repo?.full_name ?? null}
      repoDefaultBranch={repo?.default_branch ?? null}
      initialFiles={initialFiles}
      hadFirstBuild={hadFirstBuild}
    />
  );
}
