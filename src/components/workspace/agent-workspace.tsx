"use client";

/**
 * Agents view — the autonomous team working on THIS project, shown right inside
 * the workspace. For each agent you see who they are, their live status, and
 * what they've actually contributed (files touched, reports written, tasks
 * completed). The "Auto-improve" loop runs the team continuously: each tick
 * runs every active agent once (it tests the build, thinks about what to do
 * next, and applies improvements), pulls their edits into the live preview, and
 * refreshes their contributions — over and over until you stop it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  FileText,
  ListTodo,
  Loader2,
  Sparkles,
  Square,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProjectWorkforce,
  fetchProjectFiles,
  deployStarterTeam,
  type AgentContributionSummary,
} from "@/lib/actions/workforce";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AgentWorkspace({ projectId, projectName }: Props) {
  const [workforce, setWorkforce] = useState<AgentContributionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  // Refs the loop reads so it always sees the latest state without restarting.
  const loopingRef = useRef(false);
  const workforceRef = useRef<AgentContributionSummary[]>([]);
  workforceRef.current = workforce;

  const refresh = useCallback(async () => {
    const data = await getProjectWorkforce(projectId);
    setWorkforce(data);
    return data;
  }, [projectId]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // Stop the loop if the view unmounts.
    return () => {
      loopingRef.current = false;
    };
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

  /** Run one agent once; on success, pull its edits into the live preview. */
  async function runOne(agentId: string, agentName: string): Promise<void> {
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
        // Keep the workspace credit readout in sync with agent spend.
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
        // Reflect the agent's server-side edits in the preview.
        if (data.filesChanged) {
          const files = await fetchProjectFiles(projectId);
          if (files.length) useWorkspaceStore.getState().replaceFiles(files);
        }
      } else {
        pushLog({ kind: "error", agent: agentName, text: data.error ?? "Run failed" });
      }
    } catch {
      pushLog({ kind: "error", agent: agentName, text: "Could not reach the runner" });
    } finally {
      setRunningId(null);
    }
  }

  async function loop() {
    while (loopingRef.current) {
      const active = workforceRef.current.filter((w) => w.agent.status !== "paused");
      if (!active.length) {
        pushLog({ kind: "info", agent: "Team", text: "No active agents — stopping." });
        break;
      }
      for (const w of active) {
        if (!loopingRef.current) break;
        await runOne(w.agent.id, w.agent.name);
        await refresh();
        if (!loopingRef.current) break;
      }
      if (!loopingRef.current) break;
      // Breathe between rounds so the loop is observable and not a hot spin.
      await sleep(2000);
    }
    loopingRef.current = false;
    setLooping(false);
    setRunningId(null);
  }

  function startLoop() {
    if (loopingRef.current) return;
    if (!workforceRef.current.some((w) => w.agent.status !== "paused")) {
      toast.error("Deploy a team first, then start the loop.");
      return;
    }
    loopingRef.current = true;
    setLooping(true);
    pushLog({ kind: "info", agent: "Team", text: "Auto-improve started." });
    void loop();
  }

  function stopLoop() {
    loopingRef.current = false;
    setLooping(false);
    pushLog({ kind: "info", agent: "Team", text: "Auto-improve stopped." });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
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
        </div>
        <div className="flex items-center gap-2">
          {workforce.length > 0 && (
            <button
              onClick={looping ? stopLoop : startLoop}
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-3.5 text-[12px] font-medium transition-colors",
                looping
                  ? "bg-signal-red/15 text-signal-red hover:bg-signal-red/25"
                  : "bg-brass text-carbon hover:bg-brass-deep",
              )}
            >
              {looping ? (
                <>
                  <Square className="size-3.5" />
                  Stop loop
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Auto-improve
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {workforce.length === 0 ? (
        <EmptyTeam onDeploy={deployTeam} deploying={deploying} projectName={projectName} />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Agent cards */}
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            <div className="grid gap-3">
              {workforce.map((w) => (
                <AgentCard key={w.agent.id} summary={w} running={runningId === w.agent.id} />
              ))}
            </div>
          </div>

          {/* Live activity log */}
          <div className="flex w-72 shrink-0 flex-col border-l border-carbon-line">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-carbon-line px-3.5">
              <Sparkles className={cn("size-3.5", looping ? "animate-pulse text-brass" : "text-dusk-faint")} />
              <span className="text-[11.5px] font-medium text-dusk-muted">Live activity</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {log.length === 0 ? (
                <p className="px-1 py-6 text-center text-[11.5px] leading-relaxed text-dusk-faint">
                  Press <span className="text-brass">Auto-improve</span> and the team
                  starts working in a loop — testing, thinking, and shipping
                  improvements. Their progress shows up here.
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

function AgentCard({
  summary,
  running,
}: {
  summary: AgentContributionSummary;
  running: boolean;
}) {
  const { agent } = summary;
  const Icon = ROLE_PRESETS[agent.role]?.icon ?? Bot;
  const role = ROLE_PRESETS[agent.role]?.label ?? agent.role;

  return (
    <div
      className={cn(
        "rounded-xl border bg-carbon-raised p-4 transition-colors",
        running ? "border-brass/50" : "border-carbon-line",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-carbon-high",
            running && "ring-1 ring-brass/40",
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
          Deploy an engineer, a QA agent, and a designer. Once they&apos;re in
          place, hit Auto-improve and they&apos;ll work in a continuous loop —
          testing the build, deciding what to do next, and shipping improvements
          on their own.
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
