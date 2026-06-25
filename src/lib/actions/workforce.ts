"use server";

/**
 * Workspace "workforce" actions — the data behind the in-workspace Agents view.
 *
 * These power the autonomous team panel: who is on the project, what each agent
 * has actually contributed (files touched, reports written, tasks completed),
 * and the latest project files so the live preview can reflect agent edits made
 * server-side during the continuous improvement loop.
 */

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { deployAgent } from "./agents";
import { DEFAULT_AGENT_BUDGET_CREDITS } from "@/lib/credits/config";
import { ROLE_PRESETS, type Agent, type AgentRole } from "@/lib/data/agents";
import type { ProjectFile } from "@/lib/builder/types";

export interface AgentContributionSummary {
  agent: Agent;
  /** Files the agent touched on its most recent run. */
  filesTouched: string[];
  /** Total runs/reports this agent has produced (its contribution count). */
  reportsCount: number;
  /** Tasks this agent has completed. */
  tasksDone: number;
  /** Tasks still queued for this agent (its backlog of thinking-to-do). */
  tasksQueued: number;
  /** The agent's latest contribution, shown as "what it improved". */
  recentReports: {
    id: string;
    title: string;
    summary: string | null;
    createdAt: string;
  }[];
}

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
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Load the full team working on a project, each with its contribution summary.
 * Resolves to an empty list (never throws) if the agents migration hasn't been
 * applied, so the workspace degrades gracefully.
 */
export async function getProjectWorkforce(
  projectId: string,
): Promise<AgentContributionSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [agentsRes, reportsRes, tasksRes] = await Promise.all([
    supabase
      .from("agents")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("agent_reports")
      .select("id, agent_id, title, summary, created_at")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_tasks")
      .select("agent_id, status")
      .eq("user_id", user.id)
      .eq("project_id", projectId),
  ]);

  const agents = agentsRes.data ?? [];
  const reports = reportsRes.data ?? [];
  const tasks = tasksRes.data ?? [];

  return agents.map((a) => {
    const mine = reports.filter((r) => r.agent_id === a.id);
    const myTasks = tasks.filter((t) => t.agent_id === a.id);
    const memory = (a.memory ?? {}) as { lastChangedFiles?: string[] };
    return {
      agent: mapAgent(a),
      filesTouched: Array.isArray(memory.lastChangedFiles)
        ? memory.lastChangedFiles
        : [],
      reportsCount: mine.length,
      tasksDone: myTasks.filter((t) => t.status === "done").length,
      tasksQueued: myTasks.filter((t) => t.status === "queued").length,
      recentReports: mine.slice(0, 3).map((r) => ({
        id: r.id,
        title: r.title,
        summary: r.summary ?? null,
        createdAt: r.created_at,
      })),
    };
  });
}

/**
 * Fetch the project's latest saved files. Used by the Agents loop to pull
 * server-side agent edits back into the live preview.
 */
export async function fetchProjectFiles(
  projectId: string,
): Promise<ProjectFile[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId)
    .order("path");

  return (data ?? []) as ProjectFile[];
}

/**
 * Deploy a default autonomous team to a project in one click — an engineer, a
 * QA agent, and a designer. Skips any role already present so it's safe to call
 * repeatedly. Returns how many new agents were created.
 */
export async function deployStarterTeam(
  projectId: string,
): Promise<{ ok: boolean; created: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, created: 0, error: "Supabase not configured." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, created: 0, error: "Not signed in." };

  // Which roles already exist on this project — don't duplicate them.
  const { data: existing } = await supabase
    .from("agents")
    .select("role")
    .eq("user_id", user.id)
    .eq("project_id", projectId);
  const have = new Set((existing ?? []).map((r) => r.role as AgentRole));

  const team: AgentRole[] = ["developer", "qa", "design"];
  let created = 0;
  for (const role of team) {
    if (have.has(role)) continue;
    const res = await deployAgent({
      projectId,
      name: ROLE_PRESETS[role].label,
      role,
      schedule: "manual",
      // Seed each agent with a credit budget drawn from the user's Ren credits.
      budgetCents: DEFAULT_AGENT_BUDGET_CREDITS,
    });
    if (res.ok) created++;
  }

  return { ok: true, created };
}
