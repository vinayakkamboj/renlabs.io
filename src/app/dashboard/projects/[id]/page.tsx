import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowLeft, Calendar, Database, FileText, FolderGit2, GitBranch } from "lucide-react";
import { PageHeader, Panel, StatusBadge } from "@/components/platform/widgets";
import { DeployAgentButton } from "@/components/platform/deploy-agent-modal";
import { ProjectAgentList } from "@/components/platform/project-agent-list";
import { SupabaseConnect } from "@/components/platform/supabase-connect";
import { TaskQueue } from "@/components/platform/task-queue";
import { GoalsEditor } from "@/components/platform/goals-editor";
import { BriefEditor } from "@/components/platform/brief-editor";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { deleteProject } from "@/lib/actions/projects";
import { listAgents, listTasks, listReports } from "@/lib/actions/agents";
import { getSupabaseIntegration, getSupabaseSchema } from "@/lib/actions/integrations";

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

  // Workspace data for this project. All defensive — empty if the agents
  // migration hasn't been applied yet (queries resolve to null, not throw).
  const [agents, tasks, reports, goalsRow] = await Promise.all([
    listAgents(id),
    listTasks({ projectId: id }),
    listReports({ projectId: id, limit: 5 }),
    supabase
      .from("projects")
      .select("goals, brief")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const goals: string[] =
    (goalsRow.data?.goals as string[] | undefined) ?? [];
  const brief: string | null =
    (goalsRow.data?.brief as string | undefined) ?? null;
  const projectOption = [{ id: project.id, name: project.name }];

  // Per-project Supabase backend. The service-role key is never returned here —
  // getSupabaseIntegration only reports whether one is stored.
  const supabaseIntegration = await getSupabaseIntegration(project.id);
  const supabaseSchema = supabaseIntegration
    ? await getSupabaseSchema(project.id)
    : null;
  const supabaseTables =
    supabaseSchema?.ok ? (supabaseSchema.tables ?? null) : null;

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
            <Link
              href={`/workspace/${project.id}`}
              className="flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors duration-200 hover:bg-brass-deep"
            >
              Open workspace
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        }
      />

      {/* Business brief — shared context every agent reads */}
      <Panel
        className="mb-4"
        title="Business context"
        meta={
          <span className="text-[11.5px] text-dusk-faint">
            Every agent reads this
          </span>
        }
      >
        <BriefEditor projectId={project.id} initialBrief={brief} />
      </Panel>

      {/* Current goals (editable) */}
      <Panel className="mb-4" title="Current goals">
        <GoalsEditor projectId={project.id} initialGoals={goals} />
      </Panel>

      {/* Agents (per-project) + task queue */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Agents"
          meta={
            <div className="flex items-center gap-3">
              <span className="text-[11.5px] text-dusk-faint">{agents.length}</span>
              <DeployAgentButton
                projects={projectOption}
                defaultProjectId={project.id}
                variant="ghost"
              />
            </div>
          }
        >
          <ProjectAgentList agents={agents} />
        </Panel>

        <Panel title="Task queue">
          <TaskQueue projectId={project.id} tasks={tasks} />
        </Panel>
      </div>

      {/* Backend — this project's own Supabase connection */}
      <Panel
        className="mb-4"
        title={
          <span className="flex items-center gap-2">
            <Database className="size-3.5 text-brass" />
            Backend (Supabase)
          </span>
        }
        meta={
          <span className="text-[11.5px] text-dusk-faint">
            {supabaseIntegration ? "Connected" : "Not connected"}
          </span>
        }
      >
        <SupabaseConnect
          projectId={project.id}
          integration={supabaseIntegration}
          initialTables={supabaseTables}
        />
      </Panel>

      {/* Recent reports */}
      <Panel
        className="mb-4"
        title="Recent reports"
        meta={<span className="text-[11.5px] text-dusk-faint">{reports.length}</span>}
      >
        {reports.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-dusk-faint">
            No reports yet. Agents generate reports as they complete work.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {reports.map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-lg border border-carbon-line bg-carbon p-3.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-brass" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-dusk">{r.title}</p>
                  {r.summary && (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-dusk-muted">
                      {r.summary}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

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
