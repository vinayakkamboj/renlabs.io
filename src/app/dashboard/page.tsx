import Link from "next/link";
import {
  ArrowRight,
  FolderGit2,
  Github,
  GitPullRequest,
  Sparkles,
} from "lucide-react";
import { PageHeader, Panel, CountTile, StatusBadge } from "@/components/platform/widgets";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const configured = isSupabaseConfigured();

  let projectCount = 0;
  let repositoryCount = 0;
  let pullRequestCount = 0;
  let recentProjects: Array<{
    id: string;
    name: string;
    kind: string;
    status: string;
    updated_at: string;
  }> = [];

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    // Run all queries in parallel
    const [projectsResult, repositoriesResult, pullRequestsResult, recentResult] =
      await Promise.all([
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("repositories")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("pull_requests")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("projects")
          .select("id, name, kind, status, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);

    projectCount = projectsResult.count ?? 0;
    repositoryCount = repositoriesResult.count ?? 0;
    pullRequestCount = pullRequestsResult.count ?? 0;
    recentProjects = recentResult.data ?? [];
  }

  const quickStart = [
    {
      icon: Sparkles,
      title: "Start a new project",
      detail: "Describe an app — a SaaS, CRM, or dashboard — and let Ren Code scaffold it.",
      href: "/dashboard/projects/new",
      cta: "New project",
    },
    {
      icon: Github,
      title: "Connect a repository",
      detail: "Authorize GitHub and let Ren Code understand an existing codebase.",
      href: "/dashboard/integrations",
      cta: "Connect GitHub",
    },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your Ren Code workspace. Start a project or connect a repository to begin."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile
          label="Projects"
          value={projectCount}
          hint={projectCount === 0 ? "none yet" : undefined}
        />
        <CountTile
          label="Repositories"
          value={repositoryCount}
          hint={repositoryCount === 0 ? "connect GitHub" : undefined}
        />
        <CountTile
          label="Pull requests"
          value={pullRequestCount}
          hint={pullRequestCount === 0 ? "none yet" : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {quickStart.map((q) => (
          <Link
            key={q.title}
            href={q.href}
            className="group flex flex-col rounded-xl border border-carbon-line bg-carbon-raised p-6 transition-colors duration-200 hover:border-carbon-line-strong hover:bg-carbon-high/50"
          >
            <div className="flex size-11 items-center justify-center rounded-xl border border-carbon-line bg-carbon">
              <q.icon className="size-5 text-brass" strokeWidth={1.6} />
            </div>
            <h3 className="mt-5 font-serif text-[1.2rem] text-dusk">{q.title}</h3>
            <p className="mt-2 max-w-[42ch] text-[13.5px] leading-relaxed text-dusk-muted">
              {q.detail}
            </p>
            <span className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-brass">
              {q.cta}
              <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>

      <Panel className="mt-4" title="Recent projects">
        {recentProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex gap-3 text-dusk-faint">
              <FolderGit2 className="size-5" />
              <GitPullRequest className="size-5" />
            </div>
            <p className="mt-4 max-w-[40ch] text-[13.5px] leading-relaxed text-dusk-muted">
              {configured
                ? "Your recent projects will appear here once you start building."
                : "Activity from your projects and repositories will appear here once you start building."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-carbon-line/60">
            {recentProjects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-carbon-high/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderGit2 className="size-4 shrink-0 text-dusk-faint" />
                    <span className="truncate text-[13.5px] font-medium text-dusk">
                      {p.name}
                    </span>
                    <span className="hidden shrink-0 text-[12px] text-dusk-faint sm:block">
                      {p.kind === "new" ? "New build" : "Repository"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={p.status} />
                    <span className="hidden text-[12px] text-dusk-faint md:block">
                      {relativeTime(p.updated_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
