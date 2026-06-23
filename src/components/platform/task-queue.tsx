"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTask, setTaskStatus } from "@/lib/actions/agents";
import {
  TASK_STATUS_LABEL,
  type AgentTask,
  type TaskStatus,
} from "@/lib/data/agents";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<TaskStatus, string> = {
  queued: "bg-carbon-high text-dusk-muted",
  in_progress: "bg-signal-amber/15 text-signal-amber",
  blocked: "bg-signal-red/15 text-signal-red",
  done: "bg-signal-green/15 text-signal-green",
  failed: "bg-signal-red/15 text-signal-red",
};

/**
 * The project task queue. Lets the user add tasks and mark them done; both
 * persist via server actions and refresh the route so the activity feed and
 * counts update.
 */
export function TaskQueue({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: AgentTask[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function add() {
    const trimmed = title.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    const res = await createTask({ projectId, title: trimmed });
    setAdding(false);
    if (res.ok) {
      setTitle("");
      router.refresh();
    } else {
      toast.error("Could not add task");
    }
  }

  async function complete(id: string) {
    if (busyId) return;
    setBusyId(id);
    const res = await setTaskStatus(id, "done");
    setBusyId(null);
    if (res.ok) router.refresh();
    else toast.error("Could not update task");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Add a task to the queue…"
          className="h-9 w-full rounded-lg border border-carbon-line bg-carbon px-3 text-[13px] text-dusk outline-none placeholder:text-dusk-faint focus:border-carbon-line-strong"
        />
        <button
          onClick={add}
          disabled={adding || !title.trim()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brass px-3.5 text-[12.5px] font-medium text-carbon transition-colors hover:bg-brass-deep disabled:opacity-40"
        >
          {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-dusk-faint">
          No tasks yet. Add one above or let an agent queue work.
        </p>
      ) : (
        <ul className="divide-y divide-carbon-line/60">
          {tasks.map((t) => {
            const done = t.status === "done";
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <button
                  onClick={() => !done && complete(t.id)}
                  disabled={done || busyId === t.id}
                  title={done ? "Completed" : "Mark done"}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    done
                      ? "border-signal-green/40 bg-signal-green/15 text-signal-green"
                      : "border-carbon-line text-transparent hover:border-signal-green/40 hover:text-signal-green/60",
                  )}
                >
                  {busyId === t.id ? (
                    <Loader2 className="size-3 animate-spin text-dusk-muted" />
                  ) : (
                    <Check className="size-3" />
                  )}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px]",
                    done ? "text-dusk-faint line-through" : "text-dusk",
                  )}
                >
                  {t.title}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]",
                    STATUS_TONE[t.status],
                  )}
                >
                  {TASK_STATUS_LABEL[t.status]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
