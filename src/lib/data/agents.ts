/**
 * AI Workspace domain types — agents, tasks, reports, and activity.
 *
 * An agent is deployed to a project, executes tasks, and produces reports.
 * These mirror the `agents` / `agent_tasks` / `agent_reports` /
 * `activity_events` tables (see supabase/migrations/20260623_agents.sql).
 */

import {
  Beaker,
  Code2,
  Bug,
  Megaphone,
  LifeBuoy,
  PenTool,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export type AgentRole =
  | "research"
  | "developer"
  | "qa"
  | "marketing"
  | "support"
  | "design"
  | "ops";

export type AgentStatus = "idle" | "active" | "paused" | "error";

export type TaskStatus = "queued" | "in_progress" | "blocked" | "done" | "failed";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type ActivityKind =
  | "agent_deployed"
  | "agent_status"
  | "task_created"
  | "task_completed"
  | "report_generated"
  | "note";

export type AgentSchedule = "manual" | "hourly" | "daily" | "weekly";

export interface Agent {
  id: string;
  projectId: string;
  name: string;
  role: AgentRole;
  goal: string | null;
  status: AgentStatus;
  schedule: AgentSchedule;
  budgetCents: number;
  spentCents: number;
  permissions: string[];
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** True when the agent runs ambiently (server-side cron) rather than only
   *  on manual "Run" clicks — the "looping agent" mode. */
  loopEnabled: boolean;
  /** Burn-rate throttle: max tokens/minute this agent may spend. A cycle that
   *  used more tokens sleeps proportionally longer before its next run. */
  rateTokensPerMin: number;
  /** When the ambient scheduler should next consider this agent (throttle +
   *  backoff clock). Null means "due now" for a loop-enabled agent. */
  nextRunAt: string | null;
  /** Consecutive failed cycles — 3 in a row auto-pauses the loop. */
  consecutiveFailures: number;
  /** Owner-written rules the agent must follow on every run (its "constitution"). */
  instructions: string | null;
  /** What the agent works on — its scope within the project (e.g. "only the
   *  checkout flow", "docs and copy, never code"). */
  focus: string | null;
  /** Local hour [0..23] the agent may start working, inclusive. Null = any hour. */
  workingHoursStart: number | null;
  /** Local hour (0..24] the agent must stop, exclusive. Paired with start. */
  workingHoursEnd: number | null;
  /** Days the agent works: 0=Sunday .. 6=Saturday. Null/empty = every day. */
  workingDays: number[] | null;
  /** IANA timezone the working hours are interpreted in. */
  timezone: string;
  /** Hard output-token cap for a single cycle. */
  maxTokensPerRun: number;
  /** Total tokens/day this agent may spend. Null = unlimited. */
  dailyTokenBudget: number | null;
  /** Tokens spent on tokensTodayDate (rolls over at local midnight). */
  tokensSpentToday: number;
  /** The date tokensSpentToday counts toward (YYYY-MM-DD). */
  tokensTodayDate: string | null;
}

// ─── Working hours ────────────────────────────────────────────────────────────

/** Hour (0–23) and weekday (0=Sun..6=Sat) of `now` in the agent's timezone.
 *  Falls back to UTC if the stored timezone is invalid — a bad setting must
 *  never crash the scheduler. */
function localClock(timezone: string, now: Date): { hour: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(now);
    const hour =
      Number(parts.find((p) => p.type === "hour")?.value ?? now.getUTCHours()) % 24;
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = days.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
    return { hour, day: day >= 0 ? day : now.getUTCDay() };
  } catch {
    return { hour: now.getUTCHours(), day: now.getUTCDay() };
  }
}

/**
 * Is the agent inside its owner-defined working window right now?
 * No window configured = always on. Handles overnight windows (22 → 6).
 */
export function isWithinWorkingHours(
  agent: Pick<Agent, "workingHoursStart" | "workingHoursEnd" | "workingDays" | "timezone">,
  now: Date = new Date(),
): boolean {
  const { hour, day } = localClock(agent.timezone, now);
  if (agent.workingDays?.length && !agent.workingDays.includes(day)) return false;
  const start = agent.workingHoursStart;
  const end = agent.workingHoursEnd;
  if (start == null || end == null || start === end) return true;
  return start < end
    ? hour >= start && hour < end // e.g. 9 → 17
    : hour >= start || hour < end; // overnight, e.g. 22 → 6
}

/**
 * The next moment the agent's working window opens, for scheduling next_run_at
 * when a cycle lands outside the window. Scans hour-by-hour (bounded to one
 * week) — simple and DST-proof, and the scheduler only calls it on skips.
 */
export function nextWorkingWindowStart(
  agent: Pick<Agent, "workingHoursStart" | "workingHoursEnd" | "workingDays" | "timezone">,
  now: Date = new Date(),
): Date {
  const HOUR = 3_600_000;
  // Align to the top of the next hour, then find the first in-window hour.
  let t = Math.ceil(now.getTime() / HOUR) * HOUR;
  for (let i = 0; i < 24 * 7; i++, t += HOUR) {
    if (isWithinWorkingHours(agent, new Date(t))) return new Date(t);
  }
  return new Date(now.getTime() + HOUR); // no valid window found — retry in 1h
}

export interface AgentTask {
  id: string;
  projectId: string;
  agentId: string | null;
  title: string;
  detail: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AgentReport {
  id: string;
  projectId: string;
  agentId: string | null;
  taskId: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  projectId: string | null;
  agentId: string | null;
  kind: ActivityKind;
  message: string;
  createdAt: string;
}

// ─── Role presets ─────────────────────────────────────────────────────────────
// Templates that pre-fill the deploy form and give each role an identity.

export interface RolePreset {
  role: AgentRole;
  label: string;
  icon: LucideIcon;
  /** A short tagline shown in the role picker. */
  blurb: string;
  /** Default goal pre-filled when this role is chosen. */
  defaultGoal: string;
  /** Default permissions granted to this role. */
  permissions: string[];
}

export const ROLE_PRESETS: Record<AgentRole, RolePreset> = {
  research: {
    role: "research",
    label: "Research Agent",
    icon: Beaker,
    blurb: "Investigates markets, competitors, and prior art.",
    defaultGoal: "Research the market and competitors, then summarize findings.",
    permissions: ["web.read", "reports.write"],
  },
  developer: {
    role: "developer",
    label: "Developer Agent",
    icon: Code2,
    blurb: "Writes, refactors, and ships application code.",
    defaultGoal: "Implement features and fix bugs across the project codebase.",
    permissions: ["repo.read", "repo.write", "reports.write"],
  },
  qa: {
    role: "qa",
    label: "QA Agent",
    icon: Bug,
    blurb: "Tests builds and reports defects.",
    defaultGoal: "Test the latest build and file any issues found.",
    permissions: ["repo.read", "tasks.write", "reports.write"],
  },
  marketing: {
    role: "marketing",
    label: "Marketing Agent",
    icon: Megaphone,
    blurb: "Drafts copy, campaigns, and positioning.",
    defaultGoal: "Draft launch messaging and a go-to-market plan.",
    permissions: ["web.read", "reports.write"],
  },
  support: {
    role: "support",
    label: "Support Agent",
    icon: LifeBuoy,
    blurb: "Triages questions and drafts responses.",
    defaultGoal: "Triage incoming questions and draft helpful responses.",
    permissions: ["reports.write"],
  },
  design: {
    role: "design",
    label: "Design Agent",
    icon: PenTool,
    blurb: "Produces UI concepts and design critique.",
    defaultGoal: "Propose UI improvements and review the current design.",
    permissions: ["repo.read", "reports.write"],
  },
  ops: {
    role: "ops",
    label: "Ops Agent",
    icon: Settings2,
    blurb: "Handles deployment, monitoring, and infra tasks.",
    defaultGoal: "Monitor deployments and keep the project running smoothly.",
    permissions: ["repo.read", "tasks.write", "reports.write"],
  },
};

export const ROLE_LIST: RolePreset[] = Object.values(ROLE_PRESETS);

// ─── Display helpers ──────────────────────────────────────────────────────────

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  active: "Active",
  paused: "Paused",
  error: "Error",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  queued: "Queued",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  failed: "Failed",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function roleLabel(role: AgentRole): string {
  return ROLE_PRESETS[role]?.label ?? role;
}

export function roleIcon(role: AgentRole): LucideIcon {
  return ROLE_PRESETS[role]?.icon ?? Settings2;
}
