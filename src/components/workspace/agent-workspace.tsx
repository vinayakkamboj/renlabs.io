"use client";

/**
 * Agents view — the autonomous team working on THIS project, shown right
 * inside the workspace.
 *
 * Agents don't loop in this browser tab anymore — they're AMBIENT: a
 * server-side cron scheduler (`/api/cron/agents`) ticks every few minutes and
 * runs any agent whose loop is on and whose burn-rate clock says it's due.
 * That keeps working even if you close this tab or your laptop. Each agent's
 * own rate_tokens_per_min throttle decides how fast it's allowed to spend —
 * turning it down makes it slower and cheaper, never faster than the cap.
 *
 * Safety: every ambient edit lands on the project's 'ren' branch, never on
 * 'main' (what the live preview and your manual chat builds use). Nothing an
 * agent writes reaches the real app until you review the diff here and hit
 * Promote — one explicit action, one point of human review.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitBranch,
  ListTodo,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProjectWorkforce,
  deployStarterTeam,
  getAgentBranchDiff,
  promoteAgentBranch,
  type AgentContributionSummary,
  type BranchDiffEntry,
} from "@/lib/actions/workforce";
import { setAgentLoop } from "@/lib/actions/agents";
import { ROLE_PRESETS } from "@/lib/data/agents";
import { AgentStatusBadge } from "@/components/platform/agent-controls";
import { useWorkspaceStore } from "@/lib/builder/store";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  projectName: string;
}

interface LogEntry {
  id: string;
  kind: "run" | "error" | "info";
  agent: string;
  text: string;
  time: string;
}

// Presets shown for the burn-rate slider — tokens/minute the ambient loop is
// allowed to spend for one agent. Lower = slower and cheaper.
const RATE_PRESETS = [
  { label: "Slow", value: 800 },
  { label: "Normal", value: 1500 },
  { label: "Fast", value: 3500 },
] as const;

export function AgentWorkspace({ projectId, projectName }: Props) {
  const [workforce, setWorkforce] = useState<AgentContributionSummary[]>([]);
  const [diffs, setDiffs] = useState<BranchDiffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const refresh = useCallback(async () => {
    const [team, diff] = await Promise.all([
      getProjectWorkforce(projectId),
      getAgentBranchDiff(projectId),
    ]);
    setWorkforce(team);
    setDiffs(diff);
    return team;
  }, [projectId]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // Ambient agents run server-side (cron), but poll while this view is open
    // so newly-landed work shows up without a manual refresh.
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  function pushLog(entry: Omit<LogEntry, "id" | "time">) {
    setLog((l) =>
      [
        {
          ...entry,
          id: Math.random().toString(36).slice(2),
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...l,
      ].slice(0, 60),
    );
  }

  async function deployTeam() {
    setDeploying(true);
    try {
      const res = await deployStarterTeam(projectId);
      if (res.ok) {
        toast.success(
          res.created
            ? `Deployed ${res.created} agent${res.created > 1 ? "s" : ""} to ${projectName}.`
            : "Your team is already in place.",
        );
        await refresh();
      } else {
        toast.error(res.error ?? "Could not deploy the team.");
      }
    } finally {
      setDeploying(false);
    }
  }

  /** Manual one-off run — useful for testing an agent without turning its
   *  ambient loop on. Still writes to the 'ren' branch, same as the loop. */
  async function runOnce(agentId: string, agentName: string): Promise<void> {
    setRunningId(agentId);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        filesChanged?: number;
        followUpTasks?: number;
        plan?: string;
        creditsSpent?: number;
        creditsBalance?: number;
      };
      if (data.ok) {
        const bits: string[] = [];
        if (data.filesChanged) bits.push(`${data.filesChanged} file${data.filesChanged > 1 ? "s" : ""}`);
        if (data.followUpTasks) bits.push(`${data.followUpTasks} follow-up${data.followUpTasks > 1 ? "s" : ""}`);
        if (data.creditsSpent) bits.push(`−${data.creditsSpent} credits`);
        if (typeof data.creditsBalance === "number") {
          useWorkspaceStore.getState().setCreditsBalance(data.creditsBalance);
        }
        pushLog({
          kind: "run",
          agent: agentName,
          text:
            (data.plan?.trim() || "Improved the project") +
            (bits.length ? ` · ${bits.join(", ")}` : ""),
        });
        await refresh();
      } else {
        pushLog({ kind: "error", agent: agentName, text: data.error ?? "Run failed" });
      }
    } catch {
      pushLog({ kind: "error", agent: agentName, text: "Could not reach the runner" });
    } finally {
      setRunningId(null);
    }
  }

  async function toggleLoop(agentId: string, agentName: string, enable: boolean) {
    setTogglingId(agentId);
    try {
      const res = await setAgentLoop(agentId, enable);
      if (res.ok) {
        pushLog({
          kind: "info",
          agent: agentName,
          text: enable
            ? "Started looping ambiently on the ren branch."
            : "Ambient loop stopped.",
        });
        await refresh();
      } else {
        toast.error("Could not update the loop.");
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function setRate(agentId: string, agentName: string, rate: number) {
    await setAgentLoop(agentId, true, rate);
    pushLog({ kind: "info", agent: agentName, text: `Burn rate set to ${rate} tokens/min.` });
    await refresh();
  }

  async function promote() {
    setPromoting(true);
    try {
      const res = await promoteAgentBranch(projectId);
      if (res.ok) {
        toast.success(
          res.promoted
            ? `Promoted ${res.promoted} file${res.promoted > 1 ? "s" : ""} from ren to main.`
            : "Nothing to promote.",
        );
        pushLog({ kind: "info", agent: "You", text: `Promoted ${res.promoted} file(s) to main.` });
        // Pull the newly-promoted main files into the live workspace.
        const res2 = await fetch(`/api/builder/files?projectId=${encodeURIComponent(projectId)}`);
        const { files } = (await res2.json()) as { files: { path: string; content: string }[] };
        if (files?.length) useWorkspaceStore.getState().replaceFiles(files);
        await refresh();
      } else {
        toast.error(res.error ?? "Could not promote.");
      }
    } finally {
      setPromoting(false);
    }
  }

  const anyLooping = workforce.some((w) => w.agent.loopEnabled);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-carbon text-[13px] text-dusk-faint">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading your team…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-carbon">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-carbon-line px-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-brass" />
          <span className="text-[13px] font-medium text-dusk">Autonomous team</span>
          <span className="text-[11.5px] text-dusk-faint">
            {workforce.length} agent{workforce.length === 1 ? "" : "s"}
          </span>
          {anyLooping && (
            <span className="flex items-center gap-1.5 rounded-full bg-brass/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-brass">
              <span className="size-1.5 animate-pulse rounded-full bg-brass" />
              Ambient
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10.5px] text-dusk-faint">
          <GitBranch className="size-3" />
          working on <span className="text-dusk-muted">ren</span>
        </div>
      </div>

      {workforce.length === 0 ? (
        <EmptyTeam onDeploy={deployTeam} deploying={deploying} projectName={projectName} />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Agent cards */}
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {diffs.length > 0 && (
              <BranchReviewBanner
                diffs={diffs}
                onPromote={promote}
                promoting={promoting}
              />
            )}
            <div className="grid gap-3">
              {workforce.map((w) => (
                <AgentCard
                  key={w.agent.id}
                  summary={w}
                  running={runningId === w.agent.id}
                  toggling={togglingId === w.agent.id}
                  onRunOnce={() => runOnce(w.agent.id, w.agent.name)}
                  onToggleLoop={(on) => toggleLoop(w.agent.id, w.agent.name, on)}
                  onSetRate={(rate) => setRate(w.agent.id, w.agent.name, rate)}
                />
              ))}
            </div>
          </div>

          {/* Live activity log */}
          <div className="flex w-72 shrink-0 flex-col border-l border-carbon-line">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-carbon-line px-3.5">
              <Sparkles className={cn("size-3.5", anyLooping ? "animate-pulse text-brass" : "text-dusk-faint")} />
              <span className="text-[11.5px] font-medium text-dusk-muted">Live activity</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {log.length === 0 ? (
                <p className="px-1 py-6 text-center text-[11.5px] leading-relaxed text-dusk-faint">
                  Turn on an agent&apos;s <span className="text-brass">loop</span> and
                  it works ambiently in the background — even if you close this
                  tab. Progress and promotions show up here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {log.map((e) => (
                    <li key={e.id} className="flex gap-2">
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          e.kind === "error"
                            ? "bg-signal-red"
                            : e.kind === "info"
                              ? "bg-dusk-faint"
                              : "bg-signal-green",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-[11.5px] leading-snug text-dusk">
                          <span className="font-medium text-brass">{e.agent}</span>{" "}
                          <span className={e.kind === "error" ? "text-signal-red/80" : "text-dusk-muted"}>
                            {e.text}
                          </span>
                        </p>
                        <p className="mt-0.5 font-mono text-[9.5px] text-dusk-faint">{e.time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BranchReviewBanner({
  diffs,
  onPromote,
  promoting,
}: {
  diffs: BranchDiffEntry[];
  onPromote: () => void;
  promoting: boolean;
}) {
  return (
    <div className="mb-3 rounded-xl border border-brass/30 bg-brass/[0.06] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-dusk">
          <GitBranch className="size-3.5 text-brass" />
          {diffs.length} file{diffs.length > 1 ? "s" : ""} changed on{" "}
          <span className="font-mono text-brass">ren</span> — not live yet
        </div>
        <button
          onClick={onPromote}
          disabled={promoting}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-brass px-3 text-[11.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
        >
          {promoting ? <Loader2 className="size-3 animate-spin" /> : <ExternalLink className="size-3" />}
          Promote to main
        </button>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {diffs.slice(0, 8).map((d) => (
          <li
            key={d.path}
            className="rounded-md bg-carbon-raised px-2 py-1 font-mono text-[10.5px] text-dusk-muted"
            title={d.status}
          >
            {d.status === "added" ? "+" : "~"} {d.path.split("/").pop()}
          </li>
        ))}
        {diffs.length > 8 && (
          <li className="px-2 py-1 text-[10.5px] text-dusk-faint">+{diffs.length - 8} more</li>
        )}
      </ul>
    </div>
  );
}

function AgentCard({
  summary,
  running,
  toggling,
  onRunOnce,
  onToggleLoop,
  onSetRate,
}: {
  summary: AgentContributionSummary;
  running: boolean;
  toggling: boolean;
  onRunOnce: () => void;
  onToggleLoop: (on: boolean) => void;
  onSetRate: (rate: number) => void;
}) {
  const { agent } = summary;
  const Icon = ROLE_PRESETS[agent.role]?.icon ?? Bot;
  const role = ROLE_PRESETS[agent.role]?.label ?? agent.role;
  const looping = agent.loopEnabled;

  return (
    <div
      className={cn(
        "rounded-xl border bg-carbon-raised p-4 transition-colors",
        running ? "border-brass/50" : looping ? "border-brass/25" : "border-carbon-line",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-carbon-high",
            (running || looping) && "ring-1 ring-brass/40",
          )}
        >
          {running ? (
            <Loader2 className="size-4 animate-spin text-brass" />
          ) : (
            <Icon className="size-4 text-brass" strokeWidth={1.7} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-dusk">{agent.name}</p>
          <p className="text-[11px] text-dusk-faint">{role}</p>
        </div>
        {running ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brass/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-brass">
            <span className="size-1.5 animate-pulse rounded-full bg-brass" />
            Working
          </span>
        ) : (
          <AgentStatusBadge status={agent.status} />
        )}
      </div>

      {/* Contribution stats */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
        <Stat icon={<Sparkles className="size-3" />} label="contributions" value={summary.reportsCount} />
        <Stat icon={<CheckCircle2 className="size-3" />} label="tasks done" value={summary.tasksDone} />
        <Stat icon={<ListTodo className="size-3" />} label="queued" value={summary.tasksQueued} />
        {summary.filesTouched.length > 0 && (
          <Stat icon={<FileText className="size-3" />} label="files last run" value={summary.filesTouched.length} />
        )}
      </div>

      {/* Ambient loop controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-carbon-line pt-3">
        <button
          onClick={() => onToggleLoop(!looping)}
          disabled={toggling}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition-colors disabled:opacity-50",
            looping
              ? "bg-signal-red/15 text-signal-red hover:bg-signal-red/25"
              : "bg-brass text-carbon hover:bg-brass-deep",
          )}
        >
          {toggling ? (
            <Loader2 className="size-3 animate-spin" />
          ) : looping ? (
            <Pause className="size-3" />
          ) : (
            <Play className="size-3" />
          )}
          {looping ? "Stop loop" : "Start loop"}
        </button>

        {looping && (
          <div className="flex items-center gap-1">
            {RATE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => onSetRate(p.value)}
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  agent.rateTokensPerMin === p.value
                    ? "bg-carbon-high text-brass"
                    : "text-dusk-faint hover:text-dusk-muted",
                )}
                title={`${p.value} tokens/min`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onRunOnce}
          disabled={running}
          className="ml-auto flex h-7 items-center gap-1.5 rounded-lg border border-carbon-line px-2.5 text-[11px] font-medium text-dusk-muted transition-colors hover:text-dusk disabled:opacity-50"
        >
          <Zap className="size-3" />
          Run once
        </button>
      </div>

      {agent.consecutiveFailures > 0 && (
        <p className="mt-2 text-[10.5px] text-signal-amber">
          {agent.consecutiveFailures} failed cycle{agent.consecutiveFailures > 1 ? "s" : ""} in a row
          {agent.consecutiveFailures >= 3 ? " — loop auto-paused." : "."}
        </p>
      )}

      {/* What it improved — latest reports */}
      {summary.recentReports.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-carbon-line pt-3">
          {summary.recentReports.map((r) => (
            <li key={r.id} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-signal-green/70" />
              <p className="min-w-0 text-[11.5px] leading-snug text-dusk-muted">
                <span className="text-dusk">{r.title}</span>
                {r.summary && <span className="text-dusk-faint"> — {r.summary}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <span className="flex items-center gap-1.5 text-dusk-faint">
      <span className="text-dusk-muted">{icon}</span>
      <span className="font-medium text-dusk">{value}</span>
      {label}
    </span>
  );
}

function EmptyTeam({
  onDeploy,
  deploying,
  projectName,
}: {
  onDeploy: () => void;
  deploying: boolean;
  projectName: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brass/12">
          <Users className="size-5 text-brass" />
        </span>
        <h3 className="mt-4 text-[15px] font-medium text-dusk">Put a team on {projectName}</h3>
        <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-dusk-muted">
          Deploy an engineer, a QA agent, and a designer. Turn on their loop and
          they work ambiently in the background — even with this tab closed —
          on a separate <span className="font-mono text-dusk">ren</span> branch.
          You review and promote their work whenever you&apos;re ready.
        </p>
        <button
          onClick={onDeploy}
          disabled={deploying}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
        >
          {deploying ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          {deploying ? "Deploying…" : "Deploy starter team"}
        </button>
      </div>
    </div>
  );
}
