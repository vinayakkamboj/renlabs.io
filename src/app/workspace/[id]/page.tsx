import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { readGitHubSession } from "@/lib/github/session";
import { loadRepositoryFiles } from "@/lib/builder/github-loader";
import { createBaseTemplate } from "@/lib/builder/base-template";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getSupabaseIntegration } from "@/lib/actions/integrations";
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
        projectKind="new"
        repoFullName={null}
        repoDefaultBranch={null}
        initialFiles={createBaseTemplate()}
        hadFirstBuild={false}
        supabaseConnected={false}
        supabaseUrl={null}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch project, saved files, and this project's Supabase integration.
  const supabaseIntegration = await getSupabaseIntegration(id);

  const [projectResult, savedResult] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, kind, repository_id, repositories ( full_name, default_branch )",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", id)
      .eq("branch", "main"),
  ]);

  const project = projectResult.data;
  if (!project) redirect("/dashboard/projects");

  const repoRaw = project.repositories as unknown;
  const repo: RepoJoin | null = Array.isArray(repoRaw)
    ? ((repoRaw[0] as RepoJoin | undefined) ?? null)
    : ((repoRaw as RepoJoin | null) ?? null);

  // Resolve the initial file set: existing saved files → repo files → template.
  let initialFiles: ProjectFile[] = [];
  let hadFirstBuild = false;
  // Tracks whether we actually loaded the repo from GitHub (vs fell back to
  // the blank template because the session was missing or the API failed).
  let repoFilesLoaded = false;

  if (savedResult.data && savedResult.data.length) {
    initialFiles = savedResult.data as ProjectFile[];
    hadFirstBuild = true;
    repoFilesLoaded = true;
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
        hadFirstBuild = true;
        repoFilesLoaded = true;
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
      projectKind={(project.kind as "new" | "repository") ?? "new"}
      repoFullName={repo?.full_name ?? null}
      repoDefaultBranch={repo?.default_branch ?? null}
      initialFiles={initialFiles}
      hadFirstBuild={hadFirstBuild}
      repoFilesLoaded={repoFilesLoaded}
      supabaseConnected={!!supabaseIntegration}
      supabaseUrl={supabaseIntegration?.projectUrl ?? null}
    />
  );
}
