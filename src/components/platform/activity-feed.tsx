import {
  Activity,
  CheckCircle2,
  FileText,
  ListPlus,
  MessageSquare,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityEvent, ActivityKind } from "@/lib/data/agents";

const KIND_META: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  agent_deployed: { icon: Rocket, tone: "text-brass" },
  agent_status: { icon: Activity, tone: "text-signal-amber" },
  task_created: { icon: ListPlus, tone: "text-dusk-muted" },
  task_completed: { icon: CheckCircle2, tone: "text-signal-green" },
  report_generated: { icon: FileText, tone: "text-brass" },
  note: { icon: MessageSquare, tone: "text-dusk-muted" },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function ActivityFeed({
  events,
  emptyHint = "No activity yet. Deploy an agent to get work moving.",
}: {
  events: ActivityEvent[];
  emptyHint?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-dusk-faint">{emptyHint}</p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => {
        const meta = KIND_META[e.kind] ?? KIND_META.note;
        const Icon = meta.icon;
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3 pb-5">
            {/* connector line */}
            {!last && (
              <span
                aria-hidden
                className="absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px bg-carbon-line"
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-carbon-line bg-carbon",
                meta.tone,
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug text-dusk">{e.message}</p>
              <p className="mt-0.5 text-[11px] text-dusk-faint">
                {relativeTime(e.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
