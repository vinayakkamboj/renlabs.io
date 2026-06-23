"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setAgentStatus, deleteAgent } from "@/lib/actions/agents";
import type { AgentStatus } from "@/lib/data/agents";
import { cn } from "@/lib/utils";

/**
 * Pause / resume / delete controls for an agent. Optimistically refreshes the
 * route on success so server-rendered status reflects the change.
 */
export function AgentControls({
  agentId,
  status,
  redirectOnDelete,
}: {
  agentId: string;
  status: AgentStatus;
  redirectOnDelete?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"toggle" | "delete" | null>(null);

  const paused = status === "paused";

  async function toggle() {
    if (pending) return;
    setPending("toggle");
    const next: AgentStatus = paused ? "active" : "paused";
    const res = await setAgentStatus(agentId, next);
    setPending(null);
    if (res.ok) {
      toast.success(paused ? "Agent resumed" : "Agent paused");
      router.refresh();
    } else {
      toast.error("Could not update agent");
    }
  }

  async function remove() {
    if (pending) return;
    if (!confirm("Delete this agent? Its tasks and reports stay in the project.")) return;
    setPending("delete");
    const res = await deleteAgent(agentId);
    setPending(null);
    if (res.ok) {
      toast.success("Agent deleted");
      if (redirectOnDelete) router.push(redirectOnDelete);
      else router.refresh();
    } else {
      toast.error("Could not delete agent");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={toggle}
        disabled={pending !== null}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border border-carbon-line px-3 text-[12px] font-medium text-dusk-muted transition-colors hover:border-carbon-line-strong hover:text-dusk disabled:opacity-50",
        )}
      >
        {pending === "toggle" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : paused ? (
          <Play className="size-3.5" />
        ) : (
          <Pause className="size-3.5" />
        )}
        {paused ? "Resume" : "Pause"}
      </button>
      <button
        onClick={remove}
        disabled={pending !== null}
        title="Delete agent"
        className="flex size-8 items-center justify-center rounded-lg border border-carbon-line text-dusk-faint transition-colors hover:border-signal-red/40 hover:text-signal-red disabled:opacity-50"
      >
        {pending === "delete" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>
    </div>
  );
}

const STATUS_TONE: Record<AgentStatus, string> = {
  active: "bg-signal-green/15 text-signal-green",
  idle: "bg-carbon-high text-dusk-muted",
  paused: "bg-signal-amber/15 text-signal-amber",
  error: "bg-signal-red/15 text-signal-red",
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]",
        STATUS_TONE[status],
      )}
    >
      {status === "active" && (
        <span className="size-1.5 animate-pulse rounded-full bg-signal-green" />
      )}
      {status}
    </span>
  );
}
