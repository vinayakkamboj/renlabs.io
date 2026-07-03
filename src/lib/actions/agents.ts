"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ROLE_PRESETS, roleLabel } from "@/lib/data/agents";
import type {
  Agent,
  AgentReport,
  AgentRole,
  AgentSchedule,
  AgentStatus,
  AgentTask,
  ActivityEvent,
  TaskPriority,
  TaskStatus,
} from "@/lib/data/agents";

// ─── Row mappers (snake_case DB → camelCase domain) ──────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapAgent(r: any): Agent {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    role: r.role,
    goal: r.goal ?? null,
    status: r.status,
    schedule: r.schedule ?? "manual",
    budgetCents: r.budget_cents ?? 0,
    spentCents: r.spent_cents ?? 0,
    permissions: r.permissions ?? [],
    lastRunAt: r.last_run_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    loopEnabled: r.loop_enabled ?? false,
    rateTokensPerMin: r.rate_tokens_per_min ?? 1500,
    nextRunAt: r.next_run_at ?? null,
    consecutiveFailures: r.consecutive_failures ?? 0,
  };
}

function mapTask(r: any): AgentTask {
  return {
    id: r.id,
    projectId: r.project_id,
    agentId: r.agent_id ?? null,
    title: r.title,
    detail: r.detail ?? null,
    status: r.status,
    priority: r.priority,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at ?? null,
  };
}

function mapReport(r: any): AgentReport {
  return {
    id: r.id,
    projectId: r.project_id,
    agentId: r.agent_id ?? null,
    taskId: r.task_id ?? null,
    title: r.title,
    summary: r.summary ?? null,
    content: r.content ?? null,
    createdAt: r.created_at,
  };
}

function mapActivity(r: any): ActivityEvent {
  return {
    id: r.id,
    projectId: r.project_id ?? null,
    agentId: r.agent_id ?? null,
    kind: r.kind,
    message: r.message,
    createdAt: r.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Read helpers ─────────────────────────────────────────────────────────────
// All queries resolve (not throw) on a missing table, so the dashboard degrades
// gracefully to empty state if the migration hasn't been applied yet.

async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listAgents(projectId?: string): Promise<Agent[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let q = supabase
    .from("agents")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (projectId) q = q.eq("project_id", projectId);

  const { data } = await q;
  return (data ?? []).map(mapAgent);
}

export async function getAgent(id: string): Promise<Agent | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? mapAgent(data) : null;
}

export async function listTasks(opts: {
  projectId?: string;
  agentId?: string;
} = {}): Promise<AgentTask[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let q = supabase
    .from("agent_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.agentId) q = q.eq("agent_id", opts.agentId);

  const { data } = await q;
  return (data ?? []).map(mapTask);
}

export async function listReports(opts: {
  projectId?: string;
  agentId?: string;
  limit?: number;
} = {}): Promise<AgentReport[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let q = supabase
    .from("agent_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.agentId) q = q.eq("agent_id", opts.agentId);
  if (opts.limit) q = q.limit(opts.limit);

  const { data } = await q;
  return (data ?? []).map(mapReport);
}

export async function listActivity(opts: {
  projectId?: string;
  limit?: number;
} = {}): Promise<ActivityEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let q = supabase
    .from("activity_events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);

  const { data } = await q;
  return (data ?? []).map(mapActivity);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface DeployAgentInput {
  projectId: string;
  name: string;
  role: AgentRole;
  goal?: string;
  schedule?: AgentSchedule;
  budgetCents?: number;
  /** Start this agent looping ambiently right away (default: off — an agent
   *  never spends unattended until the owner explicitly turns it on). */
  loopEnabled?: boolean;
  /** Burn-rate cap in tokens/minute. Lower = slower, cheaper, safer. */
  rateTokensPerMin?: number;
}

/**
 * Deploy a new agent to a project. Records an activity event so the work feed
 * reflects it immediately. Returns the new agent id.
 */
export async function deployAgent(input: DeployAgentInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const preset = ROLE_PRESETS[input.role];
  const { data, error } = await supabase
    .from("agents")
    .insert({
      user_id: user.id,
      project_id: input.projectId,
      name: input.name.trim() || roleLabel(input.role),
      role: input.role,
      goal: input.goal?.trim() || preset?.defaultGoal || null,
      status: "active",
      schedule: input.schedule ?? "manual",
      budget_cents: input.budgetCents ?? 0,
      permissions: preset?.permissions ?? [],
      loop_enabled: input.loopEnabled ?? false,
      rate_tokens_per_min: input.rateTokensPerMin ?? 1500,
      next_run_at: input.loopEnabled ? new Date().toISOString() : null,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to deploy agent." };
  }

  await logActivity({
    projectId: input.projectId,
    agentId: data.id,
    kind: "agent_deployed",
    message: `${data.name} deployed to the project.`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agents");
  revalidatePath(`/dashboard/projects/${input.projectId}`);
  return { ok: true, id: data.id };
}

export async function setAgentStatus(
  agentId: string,
  status: AgentStatus,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data, error } = await supabase
    .from("agents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", agentId)
    .eq("user_id", user.id)
    .select("name, project_id")
    .single();

  if (error || !data) return { ok: false };

  await logActivity({
    projectId: data.project_id,
    agentId,
    kind: "agent_status",
    message: `${data.name} is now ${status}.`,
  });

  revalidatePath("/dashboard/agents");
  revalidatePath(`/dashboard/agents/${agentId}`);
  return { ok: true };
}

/**
 * Turn an agent's ambient loop on/off, and optionally set its burn-rate cap
 * (tokens/minute — lower means slower and cheaper). Enabling clears the
 * failure counter and schedules an immediate first cycle; disabling stops the
 * scheduler from picking it up again until re-enabled.
 */
export async function setAgentLoop(
  agentId: string,
  loopEnabled: boolean,
  rateTokensPerMin?: number,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data, error } = await supabase
    .from("agents")
    .update({
      loop_enabled: loopEnabled,
      ...(rateTokensPerMin ? { rate_tokens_per_min: Math.max(200, rateTokensPerMin) } : {}),
      ...(loopEnabled
        ? { next_run_at: new Date().toISOString(), consecutive_failures: 0 }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId)
    .eq("user_id", user.id)
    .select("name, project_id")
    .single();

  if (error || !data) return { ok: false };

  await logActivity({
    projectId: data.project_id,
    agentId,
    kind: "agent_status",
    message: loopEnabled
      ? `${data.name} started looping ambiently on the ren branch.`
      : `${data.name}'s ambient loop was stopped.`,
  });

  revalidatePath("/dashboard/agents");
  revalidatePath(`/dashboard/agents/${agentId}`);
  return { ok: true };
}

export async function deleteAgent(agentId: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", agentId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard/agents");
  return { ok: !error };
}

export interface CreateTaskInput {
  projectId: string;
  agentId?: string;
  title: string;
  detail?: string;
  priority?: TaskPriority;
}

export async function createTask(input: CreateTaskInput): Promise<{ ok: boolean; id?: string }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      user_id: user.id,
      project_id: input.projectId,
      agent_id: input.agentId ?? null,
      title: input.title.trim(),
      detail: input.detail?.trim() || null,
      priority: input.priority ?? "medium",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false };

  await logActivity({
    projectId: input.projectId,
    agentId: input.agentId ?? null,
    kind: "task_created",
    message: `New task queued: ${input.title.trim()}`,
  });

  revalidatePath(`/dashboard/projects/${input.projectId}`);
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const completedAt = status === "done" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("agent_tasks")
    .update({ status, completed_at: completedAt, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("title, project_id, agent_id")
    .single();

  if (error || !data) return { ok: false };

  if (status === "done") {
    await logActivity({
      projectId: data.project_id,
      agentId: data.agent_id,
      kind: "task_completed",
      message: `Task completed: ${data.title}`,
    });
  }

  revalidatePath(`/dashboard/projects/${data.project_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export interface CreateReportInput {
  projectId: string;
  agentId?: string;
  taskId?: string;
  title: string;
  summary?: string;
  content?: string;
}

export async function createReport(input: CreateReportInput): Promise<{ ok: boolean; id?: string }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data, error } = await supabase
    .from("agent_reports")
    .insert({
      user_id: user.id,
      project_id: input.projectId,
      agent_id: input.agentId ?? null,
      task_id: input.taskId ?? null,
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      content: input.content?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false };

  await logActivity({
    projectId: input.projectId,
    agentId: input.agentId ?? null,
    kind: "report_generated",
    message: `New report: ${input.title.trim()}`,
  });

  revalidatePath(`/dashboard/projects/${input.projectId}`);
  revalidatePath("/dashboard/reports");
  return { ok: true, id: data.id };
}

// ─── Activity ─────────────────────────────────────────────────────────────────

interface LogActivityInput {
  projectId?: string | null;
  agentId?: string | null;
  kind: ActivityEvent["kind"];
  message: string;
}

/** Append an activity event. Best-effort — never throws into the caller. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const userId = await getUserId();
    if (!userId) return;
    const supabase = await createClient();
    await supabase.from("activity_events").insert({
      user_id: userId,
      project_id: input.projectId ?? null,
      agent_id: input.agentId ?? null,
      kind: input.kind,
      message: input.message,
    });
  } catch {
    // Activity logging is non-critical; swallow failures.
  }
}
