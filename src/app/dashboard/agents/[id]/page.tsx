import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  Clock,
  FileText,
  Gauge,
  ScrollText,
  Target,
} from "lucide-react";
import { Panel } from "@/components/platform/widgets";
import { AgentControls, AgentStatusBadge } from "@/components/platform/agent-controls";
import { AgentSettingsButton } from "@/components/platform/agent-settings-modal";
import { RunAgentButton } from "@/components/platform/run-agent-button";
import { TaskQueue } from "@/components/platform/task-queue";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAgent, listTasks, listReports } from "@/lib/actions/agents";
import { ROLE_PRESETS } from "@/lib/data/agents";

export const dynamic = "force-dynamic";

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) redirect("/dashboard");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const agent = await getAgent(id);
  if (!agent) notFound();

  const [tasks, reports, { data: project }] = await Promise.all([
    listTasks({ agentId: id }),
    listReports({ agentId: id }),
    supabase.from("projects").select("id, name").eq("id", agent.projectId).maybeSingle(),
  ]);

  const Icon = ROLE_PRESETS[agent.role]?.icon ?? Target;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const budgetLabel =
    agent.budgetCents > 0
      ? `$${(agent.spentCents / 100).toFixed(2)} / $${(agent.budgetCents / 100).toFixed(2)}`
      : `$${(agent.spentCents / 100).toFixed(2)} spent`;

  const hoursLabel =
    agent.workingHoursStart != null && agent.workingHoursEnd != null
      ? `${String(agent.workingHoursStart).padStart(2, "0")}:00–${String(agent.workingHoursEnd).padStart(2, "0")}:00`
      : "Always on";
  const today = new Date().toISOString().slice(0, 10);
  const spentToday = agent.tokensTodayDate === today ? agent.tokensSpentToday : 0;
  const tokensLabel = agent.dailyTokenBudget
    ? `${spentToday.toLocaleString()} / ${agent.dailyTokenBudget.toLocaleString()}`
    : `${spentToday.toLocaleString()} today`;

  const stats = [
    { icon: Clock, label: "Last execution", value: relativeTime(agent.lastRunAt) },
    { icon: Coins, label: "Cost usage", value: budgetLabel },
    { icon: Gauge, label: "Tokens", value: tokensLabel },
    { icon: Clock, label: "Working hours", value: hoursLabel },
    { icon: FileText, label: "Reports", value: String(reports.length) },
    { icon: CheckCircle2, label: "Tasks completed", value: String(completedTasks) },
  ];

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/projects/${agent.projectId}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-dusk-muted transition-colors hover:text-dusk"
      >
        <ArrowLeft className="size-3.5" />
        Back to project
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex size-12 items-center justify-center rounded-xl border border-carbon-line bg-carbon-raised">
            <Icon className="size-6 text-brass" strokeWidth={1.6} />
          </span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-[1.6rem] leading-tight text-dusk">{agent.name}</h1>
              <AgentStatusBadge status={agent.status} />
            </div>
            <p className="mt-1 text-[13px] text-dusk-muted">
              {ROLE_PRESETS[agent.role]?.label}
              {project?.name && (
                <>
                  {" · "}
                  <Link
                    href={`/dashboard/projects/${agent.projectId}`}
                    className="text-dusk-muted underline-offset-2 hover:text-dusk hover:underline"
                  >
                    {project.name}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <RunAgentButton agentId={agent.id} />
          <AgentSettingsButton agent={agent} />
          <AgentControls
            agentId={agent.id}
            status={agent.status}
            redirectOnDelete="/dashboard/agents"
          />
        </div>
      </div>

      {/* Objective */}
      <Panel title="Objective">
        <p className="text-[14px] leading-relaxed text-dusk">
          {agent.goal ?? ROLE_PRESETS[agent.role]?.defaultGoal}
        </p>
        {agent.focus && (
          <p className="mt-3 text-[12.5px] text-dusk-muted">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dusk-faint">
              Scope ·{" "}
            </span>
            {agent.focus}
          </p>
        )}
        {agent.permissions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {agent.permissions.map((p) => (
              <span
                key={p}
                className="rounded-md border border-carbon-line bg-carbon px-2 py-0.5 font-mono text-[10.5px] text-dusk-muted"
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </Panel>

      {/* Owner rules — the agent's constitution, injected on every run */}
      {agent.instructions && (
        <Panel
          title="Rules"
          meta={
            <span className="flex items-center gap-1.5 text-[11.5px] text-dusk-faint">
              <ScrollText className="size-3.5" />
              Applied on every run
            </span>
          }
        >
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-dusk">
            {agent.instructions}
          </pre>
        </Panel>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-carbon-line bg-carbon-raised p-4">
            <s.icon className="size-4 text-dusk-faint" />
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-dusk-faint">
              {s.label}
            </p>
            <p className="mt-1 text-[15px] font-medium text-dusk">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tasks — assign work, then Run agent to execute the queue */}
      <Panel
        title="Tasks"
        meta={<span className="text-[11.5px] text-dusk-faint">Assign work · the agent runs the queue</span>}
      >
        <TaskQueue projectId={agent.projectId} agentId={agent.id} tasks={tasks} />
      </Panel>

      {/* Reports */}
      <Panel title="Reports" meta={<span className="text-[11.5px] text-dusk-faint">{reports.length}</span>}>
        {reports.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-dusk-faint">
            No reports generated yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-lg border border-carbon-line bg-carbon p-3.5">
                <p className="text-[13px] font-medium text-dusk">{r.title}</p>
                {r.summary && (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-dusk-muted">{r.summary}</p>
                )}
                <p className="mt-2 text-[11px] text-dusk-faint">{relativeTime(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
