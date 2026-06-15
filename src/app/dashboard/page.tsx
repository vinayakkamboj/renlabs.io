import Link from "next/link";
import { Coins, FolderGit2, Github, Sparkles, Users } from "lucide-react";
import { StatusBadge } from "@/components/platform/widgets";
import { ProjectCardActions } from "@/components/platform/project-card-actions";
import { GitHubImportButton } from "@/components/platform/github-import-button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCreditsBalance, ensureCreditsAccount } from "@/lib/credits/server";
import { redirect } from "next/navigation";

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
  let projectCount = 0;
  let creditBalance: number | null = null;
  let projects: Project[] = [];
  let sharedProjects: Project[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    await ensureCreditsAccount(user.id);

    const [pResult, creditsResult, listResult] = await Promise.all([
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      getCreditsBalance(user.id),
      supabase
        .from("projects")
        .select("id, name, kind, status, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);

    projectCount = pResult.count ?? 0;
    creditBalance = creditsResult;
    projects = listResult.data ?? [];

    try {
      const { data: collabs } = await supabase
        .from("project_collaborators")
        .select("project_id, projects(id, name, kind, status, updated_at)")
        .eq("invited_email", user.email)
        .eq("status", "accepted");

      if (collabs) {
        sharedProjects = collabs
          .map((c) => {
            const p = c.projects as unknown as Project | null;
            return p ? { ...p, shared: true } : null;
          })
          .filter(Boolean) as Project[];
      }
    } catch {
      /* table may not exist */
    }
  }

  return (
    <div className="space-y-8">
      {/* Credit strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-carbon-line bg-carbon-raised px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg border border-carbon-line bg-carbon">
            <Coins className="size-4 text-brass" strokeWidth={1.7} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-dusk">
              {creditBalance !== null ? (
                <>
                  <span className="font-mono tnum text-brass">{creditBalance.toLocaleString()}</span>
                  {" "}credits remaining
                </>
              ) : (
                "First Free Credit"
              )}
            </p>
            <p className="text-[11.5px] text-dusk-faint">
              {creditBalance !== null
                ? `≈ $${(creditBalance / 100).toFixed(2)} · 1 credit = $0.01`
                : "100 free credits on signup · worth $1.00"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[12px] text-dusk-faint">
            <span>{projectCount} project{projectCount !== 1 ? "s" : ""}</span>
          </div>
          <Link
            href="/dashboard/billing"
            className="flex h-7 items-center gap-1.5 rounded-lg border border-carbon-line bg-carbon px-3 text-[12px] text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk"
          >
            Buy credits
          </Link>
        </div>
      </div>

      {/* Your Projects */}
      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="font-serif text-[1.5rem] text-dusk">Your Projects</h1>
          <div className="flex items-center gap-2">
            <GitHubImportButton />
            <Link
              href="/dashboard/projects/new"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-brass px-3 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep"
            >
              + New project
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>

      {sharedProjects.length > 0 && (
        <section>
          <div className="mb-5 flex items-center gap-2">
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
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised transition-all duration-150 hover:border-carbon-line-strong hover:bg-carbon-high/50">
      <Link href={`/workspace/${project.id}`} className="flex flex-1 flex-col p-4">
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
        <p className="mt-0.5 text-[11.5px] text-dusk-faint/60">
          Updated {relativeTime(project.updated_at)}
        </p>
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

function EmptyProjects() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-carbon-line bg-carbon-raised py-16 text-center">
      <FolderGit2 className="size-8 text-dusk-faint/40" />
      <p className="mt-4 text-[14px] font-medium text-dusk">No projects yet</p>
      <p className="mt-1.5 max-w-[36ch] text-[13px] text-dusk-muted">
        Start from a prompt or connect an existing GitHub repository.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard/projects/new?mode=new"
          className="flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[13px] font-medium text-carbon transition-colors hover:bg-brass-deep"
        >
          <Sparkles className="size-3.5" />
          Start a new app
        </Link>
        <GitHubImportButton />
      </div>
    </div>
  );
}
