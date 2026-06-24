import Link from "next/link";
import { ArrowRight, Coins, FolderGit2, Github, Sparkles, Users } from "lucide-react";
import { StatusBadge, Panel } from "@/components/platform/widgets";
import { ProjectCardActions } from "@/components/platform/project-card-actions";
import { GitHubImportButton } from "@/components/platform/github-import-button";
import { CollaborationRequests } from "@/components/platform/collaboration-requests";
import { ActivityFeed } from "@/components/platform/activity-feed";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCreditsAccount, ensureCreditsAccount } from "@/lib/credits/server";
import { listActivity } from "@/lib/actions/agents";
import { type ActivityEvent } from "@/lib/data/agents";
import { redirect } from "next/navigation";
import type { IncomingInvitation } from "@/lib/actions/collaborators";

export const dynamic = "force-dynamic";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface Project {
  id: string;
  name: string;
  kind: string;
  status: string;
  updated_at: string;
  shared?: boolean;
}

export default async function DashboardPage() {
  let creditBalance: number | null = null;
  let freeGenerations = 0;
  let projects: Project[] = [];
  let sharedProjects: Project[] = [];
  let incomingInvitations: IncomingInvitation[] = [];
  let recentActivity: ActivityEvent[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // One parallel batch — projects, credits, shared projects, pending
    // invitations, agents, and activity all fetched together. Supabase queries
    // resolve (not throw) on error, so a missing table just yields null data
    // instead of failing (graceful before the agents migration is applied).
    const [account, listResult, collabResult, inviteResult, activity] =
      await Promise.all([
        getCreditsAccount(user.id),
        supabase
          .from("projects")
          .select("id, name, kind, status, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("project_collaborators")
          .select("project_id, projects(id, name, kind, status, updated_at)")
          .eq("invited_user_id", user.id)
          .eq("status", "accepted"),
        supabase
          .from("project_collaborators")
          .select("id, project_id, project_name, invited_by_email, created_at")
          .eq("invited_user_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        listActivity({ limit: 8 }),
      ]);

    recentActivity = activity;

    // Brand-new user with no credits row yet — seed it in the background so the
    // page never blocks on a write.
    if (!account) ensureCreditsAccount(user.id).catch(() => {});

    creditBalance = account?.balance ?? null;
    freeGenerations = account?.freeGenerations ?? (account ? 0 : 1);
    projects = listResult.data ?? [];

    if (collabResult.data) {
      sharedProjects = collabResult.data
        .map((c) => {
          const p = c.projects as unknown as Project | null;
          return p ? { ...p, shared: true } : null;
        })
        .filter(Boolean) as Project[];
    }

    incomingInvitations = (inviteResult.data ?? []).map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      projectName: (r.project_name as string) ?? "Untitled project",
      invitedByEmail: (r.invited_by_email as string) ?? "A Ren Code user",
      createdAt: r.created_at as string,
    }));
  }

  const projectCount = projects.length;

  return (
    <div className="space-y-8">
      {/* Welcome header + primary actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[1.85rem] leading-tight text-dusk">
            Workspace
          </h1>
          <p className="mt-1.5 text-[13.5px] text-dusk-muted">
            Create projects and deploy AI agents to work on them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GitHubImportButton />
          <Link
            href="/dashboard/projects/new"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brass px-4 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep"
          >
            <Sparkles className="size-3.5" />
            New project
          </Link>
        </div>
      </div>

      {/* Credits card */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-carbon-line bg-carbon-raised px-5 py-4">
        <div className="flex size-10 items-center justify-center rounded-xl border border-carbon-line bg-carbon">
          <Coins className="size-[18px] text-brass" strokeWidth={1.7} />
        </div>
        <div>
          <p className="text-[14px] font-medium text-dusk">
            {creditBalance !== null && creditBalance > 0 ? (
              <>
                <span className="font-mono tnum text-brass">
                  {creditBalance.toLocaleString()}
                </span>{" "}
                credits
              </>
            ) : freeGenerations > 0 ? (
              <>
                <span className="font-mono tnum text-brass">
                  {freeGenerations}
                </span>{" "}
                free generation{freeGenerations !== 1 ? "s" : ""}
              </>
            ) : (
              "No credits left"
            )}
          </p>
          <p className="text-[11.5px] text-dusk-faint">
            {creditBalance !== null && creditBalance > 0
              ? `≈ $${(creditBalance / 100).toFixed(2)} available · 1 credit = $0.01`
              : freeGenerations > 0
                ? "Your first build is on us — then top up with credits"
                : "Buy credits to keep building"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-[12px] text-dusk-faint">
            {projectCount} project{projectCount !== 1 ? "s" : ""}
          </span>
          <Link
            href="/dashboard/billing"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-3.5 text-[12.5px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk"
          >
            Buy credits
          </Link>
        </div>
      </div>

      <CollaborationRequests invitations={incomingInvitations} />

      {/* Projects grid — the create tile is always the first card so the
          primary action is one click away whether or not you have projects. */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <FolderGit2 className="size-4 text-dusk-faint" />
          <h2 className="font-serif text-[1.2rem] text-dusk">Projects</h2>
          {projectCount > 0 && (
            <span className="text-[12px] text-dusk-faint">· {projectCount}</span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NewProjectTile />
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>

      {sharedProjects.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-4 text-dusk-faint" />
            <h2 className="font-serif text-[1.2rem] text-dusk">Shared with you</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sharedProjects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* Activity is secondary — a compact panel at the bottom. */}
      {recentActivity.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-serif text-[1.2rem] text-dusk">Recent activity</h2>
            <Link
              href="/dashboard/activity"
              className="text-[12.5px] text-dusk-muted transition-colors hover:text-dusk"
            >
              View all
            </Link>
          </div>
          <Panel padded>
            <ActivityFeed events={recentActivity} />
          </Panel>
        </section>
      )}
    </div>
  );
}

function NewProjectTile() {
  return (
    <Link
      href="/dashboard/projects/new"
      className="group flex min-h-[124px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-carbon-line bg-carbon-raised/40 p-4 text-center transition-all duration-150 hover:border-brass/40 hover:bg-carbon-raised"
    >
      <div className="flex size-9 items-center justify-center rounded-xl border border-carbon-line bg-carbon text-brass transition-colors group-hover:border-brass/40">
        <Sparkles className="size-4" />
      </div>
      <span className="text-[13px] font-medium text-dusk">New project</span>
      <span className="text-[11.5px] text-dusk-faint">Start from a prompt or repo</span>
    </Link>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-carbon-line bg-carbon-raised transition-all duration-150 hover:-translate-y-0.5 hover:border-carbon-line-strong hover:bg-carbon-high/50 hover:shadow-lg hover:shadow-carbon/40">
      <Link href={`/workspace/${project.id}`} className="flex flex-1 flex-col rounded-xl p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {project.kind === "new" ? (
              <Sparkles className="size-4 shrink-0 text-brass" />
            ) : (
              <Github className="size-4 shrink-0 text-dusk-faint" />
            )}
            <span className="truncate text-[14px] font-medium text-dusk">
              {project.name}
            </span>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-3 text-[12px] text-dusk-faint">
          {project.kind === "new" ? "New build" : "Repository"}
        </p>
        <div className="mt-0.5 flex items-center justify-between">
          <p className="text-[11.5px] text-dusk-faint/60">
            Updated {relativeTime(project.updated_at)}
          </p>
          <ArrowRight className="size-3.5 -translate-x-1 text-brass opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
        </div>
        {project.shared && (
          <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-carbon-high px-2 py-0.5 text-[11px] text-dusk-muted">
            <Users className="size-3" /> Shared
          </span>
        )}
      </Link>

      {/* Actions menu */}
      <div className="absolute right-3 top-3">
        <ProjectCardActions projectId={project.id} projectName={project.name} />
      </div>
    </div>
  );
}
