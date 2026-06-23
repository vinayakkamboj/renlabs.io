"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play, Bot } from "lucide-react";
import { toast } from "sonner";
import { setAgentStatus } from "@/lib/actions/agents";
import { AgentStatusBadge } from "./agent-controls";
import { ROLE_PRESETS, type Agent } from "@/lib/data/agents";

/**
 * Per-project agent list with inline power controls. Each row lets the user:
 *   • open the agent's detail page (name link)
 *   • Run the agent now (one autonomous iteration via /api/agents/run)
 *   • Start / Stop the agent (toggles active ⇄ paused)
 *
 * This lives inside a project so agents are always managed in the context of
 * the project they work on — there is no global agent list.
 */
export function ProjectAgentList({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) {
    return (
      <p className="py-4 text-center text-[13px] text-dusk-faint">
        No agents on this project yet. Deploy one to start work.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {agents.map((a) => (
        <AgentRow key={a.id} agent={a} />
      ))}
    </ul>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const Icon = ROLE_PRESETS[agent.role]?.icon ?? Bot;
  const paused = agent.status === "paused";

  async function run() {
    if (running || paused) return;
    setRunning(true);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        filesChanged?: number;
        followUpTasks?: number;
      };
      if (data.ok) {
        const bits: string[] = [];
        if (data.filesChanged) bits.push(`${data.filesChanged} file(s) changed`);
        if (data.followUpTasks) bits.push(`${data.followUpTasks} task(s) queued`);
        toast.success(bits.length ? `Run complete — ${bits.join(", ")}.` : "Run complete.");
        router.refresh();
      } else {
        toast.error(data.error ?? "The run failed.");
      }
    } catch {
      toast.error("Could not reach the agent runner.");
    } finally {
      setRunning(false);
    }
  }

  async function toggle() {
    if (toggling) return;
    setToggling(true);
    const next = paused ? "active" : "paused";
    const res = await setAgentStatus(agent.id, next);
    setToggling(false);
    if (res.ok) {
      toast.success(paused ? "Agent started" : "Agent stopped");
      router.refresh();
    } else {
      toast.error("Could not update agent");
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-carbon-line bg-carbon p-3">
      <Icon className="size-4 shrink-0 text-brass" strokeWidth={1.7} />
      <Link
        href={`/dashboard/agents/${agent.id}`}
        className="min-w-0 flex-1 truncate text-[13px] font-medium text-dusk transition-colors hover:text-brass"
      >
        {agent.name}
      </Link>
      <AgentStatusBadge status={agent.status} />

      {/* Run now — disabled while stopped */}
      <button
        onClick={run}
        disabled={running || paused}
        title={paused ? "Start the agent first" : "Run one iteration now"}
        className="flex h-7 items-center gap-1.5 rounded-lg bg-brass px-2.5 text-[11.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
      >
        {running ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
        Run
      </button>

      {/* Start / Stop */}
      <button
        onClick={toggle}
        disabled={toggling}
        title={paused ? "Start agent" : "Stop agent"}
        className="flex size-7 items-center justify-center rounded-lg border border-carbon-line text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk disabled:opacity-40"
      >
        {toggling ? (
          <Loader2 className="size-3 animate-spin" />
        ) : paused ? (
          <Play className="size-3" />
        ) : (
          <Pause className="size-3" />
        )}
      </button>
    </li>
  );
}
