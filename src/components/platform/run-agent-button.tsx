"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

interface RunResponse {
  ok: boolean;
  error?: string;
  filesChanged?: number;
  followUpTasks?: number;
}

export function RunAgentButton({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = (await res.json()) as RunResponse;
      if (data.ok) {
        const bits = [];
        if (data.filesChanged) bits.push(`${data.filesChanged} file(s) changed`);
        if (data.followUpTasks) bits.push(`${data.followUpTasks} follow-up task(s) queued`);
        toast.success(
          bits.length ? `Run complete — ${bits.join(", ")}.` : "Run complete — report generated.",
        );
        router.refresh();
      } else {
        toast.error(data.error ?? "The run failed.");
      }
    } catch {
      toast.error("The run could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={pending}
      className="flex h-9 items-center gap-2 rounded-lg bg-brass px-4 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
      {pending ? "Agent is working…" : "Run agent"}
    </button>
  );
}
