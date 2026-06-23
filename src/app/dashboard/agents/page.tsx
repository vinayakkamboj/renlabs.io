import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/platform/widgets";
import { AgentStatusBadge } from "@/components/platform/agent-controls";
import { DeployAgentButton } from "@/components/platform/deploy-agent-modal";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listAgents } from "@/lib/actions/agents";
import { ROLE_PRESETS } from "@/lib/data/agents";

export const dynamic = "force-dynamic";

interface ProjectRow {
  id: string;
  name: string;
}

export default async function AgentsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Bot}
        title="Agents are unavailable"
        description="Supabase isn't configured on this deployment."
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: projectData }, agents] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    listAgents(),
  ]);

  const projects = (projectData ?? []) as ProjectRow[];
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <div>
      <PageHeader
        title="Agents"
        description="The AI agents working across your projects. Deploy specialists — research, development, QA, and more — and they execute against the goals you set."
        action={<DeployAgentButton projects={projects} />}
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents deployed yet"
          description="Deploy your first agent to a project and it starts working against the goal you give it."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => {
            const Icon = ROLE_PRESETS[a.role]?.icon ?? Bot;
            return (
              <Link
                key={a.id}
                href={`/dashboard/agents/${a.id}`}
                className="group flex flex-col rounded-xl border border-carbon-line bg-carbon-raised p-4 transition-all duration-150 hover:border-carbon-line-strong hover:bg-carbon-high/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-carbon-line bg-carbon">
                    <Icon className="size-[18px] text-brass" strokeWidth={1.7} />
                  </span>
                  <AgentStatusBadge status={a.status} />
                </div>
                <p className="mt-3.5 text-[14px] font-medium text-dusk">{a.name}</p>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-dusk-muted">
                  {a.goal ?? ROLE_PRESETS[a.role]?.defaultGoal}
                </p>
                <p className="mt-3 text-[11.5px] text-dusk-faint">
                  {projectName.get(a.projectId) ?? "Unknown project"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
