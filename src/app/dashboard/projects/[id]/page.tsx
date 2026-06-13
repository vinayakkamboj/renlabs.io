import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, FolderGit2, GitBranch } from "lucide-react";
import { PageHeader, Panel, StatusBadge } from "@/components/platform/widgets";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { deleteProject } from "@/lib/actions/projects";

export const metadata: Metadata = { title: "Project" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    redirect("/dashboard/projects");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the project with optional repository join
  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      name,
      kind,
      status,
      description,
      prompt,
      created_at,
      updated_at,
      repository_id,
      repositories (
        id,
        full_name,
        default_branch,
        is_private,
        language,
        index_state
      )
    `,
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !project) {
    notFound();
  }

  type RepoJoin = {
    id: string;
    full_name: string;
    default_branch: string;
    is_private: boolean;
    language: string | null;
    index_state: string;
  };
  // Supabase types a to-one relationship as an array; normalize to a single row.
  const repoRaw = project.repositories as unknown;
  const repo: RepoJoin | null = Array.isArray(repoRaw)
    ? ((repoRaw[0] as RepoJoin | undefined) ?? null)
    : ((repoRaw as RepoJoin | null) ?? null);

  const createdAt = new Date(project.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const updatedAt = new Date(project.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1.5 text-[13px] text-dusk-muted transition-colors hover:text-dusk"
        >
          <ArrowLeft className="size-3.5" />
          All projects
        </Link>
      </div>

      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={project.status} />
            <button
              className="flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors duration-200 hover:bg-brass-deep disabled:opacity-50"
              disabled
              title="Coming soon"
            >
              Start building
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Project details */}
        <Panel title="Project details">
          <dl className="space-y-4">
            <div className="flex items-start gap-3">
              <FolderGit2 className="mt-0.5 size-4 shrink-0 text-dusk-faint" />
              <div>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
                  Type
                </dt>
                <dd className="mt-1 text-[13.5px] text-dusk">
                  {project.kind === "new" ? "New application" : "Repository project"}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-4 shrink-0 text-dusk-faint" />
              <div>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
                  Created
                </dt>
                <dd className="mt-1 text-[13.5px] text-dusk">{createdAt}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-4 shrink-0 text-dusk-faint" />
              <div>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
                  Last updated
                </dt>
                <dd className="mt-1 text-[13.5px] text-dusk">{updatedAt}</dd>
              </div>
            </div>
          </dl>
        </Panel>

        {/* Prompt (for new projects) */}
        {project.kind === "new" && project.prompt ? (
          <Panel title="Prompt">
            <p className="text-[13.5px] leading-relaxed text-dusk">{project.prompt}</p>
          </Panel>
        ) : null}

        {/* Linked repository */}
        {repo ? (
          <Panel title="Linked repository">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderGit2 className="size-4 text-dusk-faint" />
                <Link
                  href={`/dashboard/repositories/${repo.id}`}
                  className="font-mono text-[13px] text-dusk transition-colors hover:text-brass"
                >
                  {repo.full_name}
                </Link>
                <span className="rounded-full border border-carbon-line px-2 py-0.5 font-mono text-[10.5px] text-dusk-faint">
                  {repo.is_private ? "private" : "public"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <GitBranch className="size-4 text-dusk-faint" />
                <span className="font-mono text-[12.5px] text-dusk-muted">
                  {repo.default_branch}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-dusk-faint">
                  Index
                </span>
                <StatusBadge status={repo.index_state} />
              </div>
            </div>
          </Panel>
        ) : null}

        {/* No linked repo for repository kind */}
        {project.kind === "repository" && !repo ? (
          <Panel title="Repository">
            <p className="text-[13.5px] leading-relaxed text-dusk-muted">
              No repository linked.{" "}
              <Link
                href="/dashboard/repositories"
                className="text-brass hover:underline"
              >
                Connect one from your repositories.
              </Link>
            </p>
          </Panel>
        ) : null}
      </div>

      {/* Danger zone */}
      <Panel className="mt-4" title="Danger zone">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13.5px] font-medium text-dusk">Delete project</p>
            <p className="mt-1 text-[12.5px] text-dusk-muted">
              Permanently removes this project. This action cannot be undone.
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await deleteProject(id);
            }}
          >
            <button
              type="submit"
              className="flex h-9 items-center rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 text-[12.5px] font-medium text-signal-red transition-colors hover:bg-signal-red/20"
            >
              Delete
            </button>
          </form>
        </div>
      </Panel>
    </>
  );
}
