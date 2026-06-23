"use server";

/**
 * Autonomous agent runner — the execution engine behind the Agents tab.
 *
 * A run does real work, not a simulation:
 *   1. Picks a queued task (or runs an explicit one).
 *   2. Loads the project's current files and the agent's memory.
 *   3. Calls Astra with the real builder prompt.
 *   4. For code roles: parses the file-patch block, validates it, applies it to
 *      the project, and persists the new files to `project_files`.
 *   5. Writes a real report describing what changed.
 *   6. Reflection pass: re-reads the project and queues concrete follow-up tasks
 *      for the areas that still need development.
 *   7. Updates agent memory + last_run_at and logs activity.
 *
 * Everything is gated by the signed-in user and RLS — an agent can only ever
 * touch its own owner's project.
 */

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { completeAstraText, isAstraConfigured } from "@/lib/ai/astra";
import { buildEditPrompt, buildNewProjectPrompt } from "@/lib/builder/prompts";
import { buildContextPack } from "@/lib/builder/context";
import {
  parseFilePatchPlan,
  detectFatalIssues,
  applyPatchPlan,
  describeFatalIssues,
} from "@/lib/builder/file-patches";
import { ROLE_PRESETS } from "@/lib/data/agents";
import type { AgentRole } from "@/lib/data/agents";
import type { ProjectFile } from "@/lib/builder/types";
import { logActivity } from "@/lib/actions/agents";

/** Roles that write code into the project. Others produce written reports. */
const CODE_ROLES: AgentRole[] = ["developer", "qa", "design", "ops"];

const MAX_OUTPUT_TOKENS = 32_000;

interface RunResult {
  ok: boolean;
  error?: string;
  reportId?: string;
  filesChanged?: number;
  followUpTasks?: number;
}

export async function runAgentTask(
  agentId: string,
  taskId?: string,
): Promise<RunResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  if (!isAstraConfigured()) return { ok: false, error: "Astra is not configured." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // ── Load the agent (RLS scopes this to the owner) ──────────────────────────
  const { data: agentRow } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!agentRow) return { ok: false, error: "Agent not found." };

  const role = agentRow.role as AgentRole;
  const projectId = agentRow.project_id as string;
  const goal: string =
    agentRow.goal ?? ROLE_PRESETS[role]?.defaultGoal ?? "Improve the project.";
  const memory = (agentRow.memory ?? {}) as Record<string, unknown>;

  // ── Pick the task to run ───────────────────────────────────────────────────
  let task: { id: string; title: string; detail: string | null } | null = null;
  if (taskId) {
    const { data } = await supabase
      .from("agent_tasks")
      .select("id, title, detail")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle();
    task = data ?? null;
  } else {
    // Next queued task assigned to this agent, else any queued task on the project.
    const { data } = await supabase
      .from("agent_tasks")
      .select("id, title, detail, agent_id")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(20);
    const rows = data ?? [];
    task =
      rows.find((r) => r.agent_id === agentId) ??
      rows.find((r) => r.agent_id === null) ??
      null;
  }

  // No explicit task: synthesize one from the agent's standing goal so a run is
  // never a no-op. The agent works toward its objective directly.
  const taskTitle = task?.title ?? goal;
  const taskDetail = task?.detail ?? null;

  if (task) {
    await supabase
      .from("agent_tasks")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("user_id", user.id);
  }

  // ── Load project files ─────────────────────────────────────────────────────
  const { data: fileRows } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId);
  const files: ProjectFile[] = (fileRows ?? []) as ProjectFile[];
  const isFirstBuild = files.length === 0;

  const memoryNote =
    Object.keys(memory).length > 0
      ? `\n\n## Your memory from previous runs\n${JSON.stringify(memory, null, 2)}`
      : "";

  // ── Code roles: real build ─────────────────────────────────────────────────
  if (CODE_ROLES.includes(role)) {
    const system = isFirstBuild ? buildNewProjectPrompt() : buildEditPrompt();
    const contextPack = buildContextPack(files, taskTitle, {});
    const request = [
      `You are the **${ROLE_PRESETS[role]?.label ?? role}** working autonomously toward this objective:`,
      `> ${goal}`,
      ``,
      `## Task to complete now`,
      `**${taskTitle}**`,
      taskDetail ? `\n${taskDetail}` : "",
      memoryNote,
      ``,
      `Make the change end-to-end and emit the file_patches block.`,
    ].join("\n");

    let result = await completeAstraText(
      [
        { role: "system", content: system },
        { role: "user", content: `${contextPack}\n\n---\n\n## Request\n${request}` },
      ],
      { temperature: 0.3, maxTokens: MAX_OUTPUT_TOKENS },
    );

    if (!result.ok) {
      await failTask(supabase, user.id, task?.id);
      return { ok: false, error: `Astra error: ${result.detail}` };
    }

    let plan = parseFilePatchPlan(result.text);
    let issues = plan ? detectFatalIssues(plan, files, isFirstBuild) : [];

    // One repair pass if the first attempt produced nothing usable or had issues.
    if (!plan || issues.length > 0) {
      const repairNote = plan
        ? `The previous attempt had these issues:\n${describeFatalIssues(issues)}`
        : "The previous attempt produced no valid file_patches block.";
      result = await completeAstraText(
        [
          { role: "system", content: system },
          {
            role: "user",
            content: `${contextPack}\n\n---\n\n## Request\n${request}\n\n## IMPORTANT — fix and re-emit\n${repairNote}\nRe-emit the COMPLETE file_patches block, correct this time.`,
          },
        ],
        { temperature: 0.3, maxTokens: MAX_OUTPUT_TOKENS },
      );
      if (result.ok) {
        const retried = parseFilePatchPlan(result.text);
        if (retried) {
          const retriedIssues = detectFatalIssues(retried, files, isFirstBuild);
          if (retriedIssues.length < issues.length || issues.length === 0) {
            plan = retried;
            issues = retriedIssues;
          }
        }
      }
    }

    if (!plan || issues.length > 0) {
      await failTask(supabase, user.id, task?.id);
      const detail = issues.length ? describeFatalIssues(issues) : "No valid changes produced.";
      await writeReport(supabase, user.id, {
        projectId,
        agentId,
        taskId: task?.id ?? null,
        title: `Run blocked: ${taskTitle}`,
        summary: `The agent could not produce a clean change. ${issues.length} issue(s).`,
        content: detail,
      });
      return { ok: false, error: "The agent could not produce a clean, applicable change." };
    }

    // Apply + persist the new file set.
    const nextFiles = applyPatchPlan(files, plan);
    await persistFiles(supabase, user.id, projectId, nextFiles, plan.deletes ?? []);

    const changedPaths = [
      ...plan.changes.map((c) => c.path),
      ...(plan.edits ?? []).map((e) => e.path),
    ];
    const uniqueChanged = Array.from(new Set(changedPaths));

    const report = await writeReport(supabase, user.id, {
      projectId,
      agentId,
      taskId: task?.id ?? null,
      title: plan.plan || `Completed: ${taskTitle}`,
      summary: `Updated ${uniqueChanged.length} file(s): ${uniqueChanged.slice(0, 6).join(", ")}${uniqueChanged.length > 6 ? "…" : ""}`,
      content: [
        `## ${plan.plan || taskTitle}`,
        ``,
        `### Files changed`,
        ...uniqueChanged.map((p) => `- \`${p}\``),
        ...(plan.deletes?.length ? [``, `### Deleted`, ...plan.deletes.map((p) => `- \`${p}\``)] : []),
      ].join("\n"),
    });

    if (task) await completeTask(supabase, user.id, task.id, task.title, agentId, projectId);
    await finishRun(supabase, user.id, agentId, projectId, {
      ...memory,
      lastTask: taskTitle,
      lastChanged: uniqueChanged.slice(0, 12),
    });

    // ── Reflection: what still needs development → queue follow-up tasks ──────
    const followUps = await reflectAndQueue(supabase, user.id, {
      projectId,
      agentId,
      role,
      goal,
      files: nextFiles,
      justDid: plan.plan || taskTitle,
    });

    revalidatePath(`/dashboard/agents/${agentId}`);
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath(`/workspace/${projectId}`);
    return {
      ok: true,
      reportId: report ?? undefined,
      filesChanged: uniqueChanged.length,
      followUpTasks: followUps,
    };
  }

  // ── Non-code roles: produce a written report ───────────────────────────────
  const system = `You are the ${ROLE_PRESETS[role]?.label ?? role} for a software product, working autonomously toward a standing objective. Produce a concise, concrete, professional report in Markdown. No emojis. No filler. Specific, actionable findings only. Start with a one-line summary, then sections with real recommendations.`;
  const fileList = files.map((f) => f.path).join("\n");
  const request = [
    `## Objective`,
    goal,
    ``,
    `## Task`,
    taskTitle,
    taskDetail ? `\n${taskDetail}` : "",
    memoryNote,
    files.length ? `\n## Current project files\n${fileList}` : "",
    ``,
    `Write the report now.`,
  ].join("\n");

  const result = await completeAstraText(
    [
      { role: "system", content: system },
      { role: "user", content: request },
    ],
    { temperature: 0.5, maxTokens: 4_000 },
  );

  if (!result.ok) {
    await failTask(supabase, user.id, task?.id);
    return { ok: false, error: `Astra error: ${result.detail}` };
  }

  const firstLine = result.text.trim().split("\n")[0].replace(/^#+\s*/, "").slice(0, 120);
  const report = await writeReport(supabase, user.id, {
    projectId,
    agentId,
    taskId: task?.id ?? null,
    title: firstLine || `Report: ${taskTitle}`,
    summary: firstLine,
    content: result.text.trim(),
  });

  if (task) await completeTask(supabase, user.id, task.id, task.title, agentId, projectId);
  await finishRun(supabase, user.id, agentId, projectId, {
    ...memory,
    lastTask: taskTitle,
  });

  revalidatePath(`/dashboard/agents/${agentId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true, reportId: report ?? undefined };
}

// ─── Reflection ────────────────────────────────────────────────────────────────

/**
 * After a code change, ask Astra to read the current project and name the
 * concrete areas that still need development, then queue them as tasks. This is
 * what makes the agent iterative — each run leaves a backlog of real next steps.
 */
async function reflectAndQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ctx: {
    projectId: string;
    agentId: string;
    role: AgentRole;
    goal: string;
    files: ProjectFile[];
    justDid: string;
  },
): Promise<number> {
  // Don't pile up an unbounded backlog — only queue follow-ups if the project
  // has few open tasks already.
  const { count } = await supabase
    .from("agent_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", ctx.projectId)
    .eq("status", "queued");
  if ((count ?? 0) >= 6) return 0;

  const fileList = ctx.files.map((f) => f.path).join("\n");
  const system = `You are a senior engineer reviewing a React + Vite + Tailwind project to plan the next iteration. Given the project's files and what was just completed, identify the highest-value concrete next steps that move toward the objective. Respond with ONLY a JSON array of 1-3 short task titles (imperative, specific, each buildable in one pass), e.g. ["Add a checkout page with order summary","Wire the cart store to the product grid"]. No prose, no markdown fences, just the JSON array.`;
  const user = [
    `## Objective`,
    ctx.goal,
    ``,
    `## Just completed`,
    ctx.justDid,
    ``,
    `## Current files`,
    fileList,
    ``,
    `List the next 1-3 tasks as a JSON array.`,
  ].join("\n");

  const result = await completeAstraText(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.4, maxTokens: 600 },
  );
  if (!result.ok) return 0;

  const titles = parseTaskTitles(result.text);
  if (titles.length === 0) return 0;

  let queued = 0;
  for (const title of titles.slice(0, 3)) {
    const { error } = await supabase.from("agent_tasks").insert({
      user_id: userId,
      project_id: ctx.projectId,
      agent_id: ctx.agentId,
      title,
      priority: "medium",
    });
    if (!error) queued++;
  }

  if (queued > 0) {
    await logActivity({
      projectId: ctx.projectId,
      agentId: ctx.agentId,
      kind: "task_created",
      message: `Agent identified ${queued} follow-up task(s) for the next iteration.`,
    });
  }
  return queued;
}

/** Pull a JSON array of strings out of a (possibly fenced) model response. */
function parseTaskTitles(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 140);
  } catch {
    return [];
  }
}

// ─── Persistence helpers ────────────────────────────────────────────────────────

async function persistFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  files: ProjectFile[],
  deletes: string[],
): Promise<void> {
  if (deletes.length) {
    await supabase
      .from("project_files")
      .delete()
      .eq("project_id", projectId)
      .in("path", deletes);
  }
  const rows = files.map((f) => ({
    project_id: projectId,
    user_id: userId,
    path: f.path,
    content: f.content,
  }));
  await supabase.from("project_files").upsert(rows, { onConflict: "project_id,path" });
}

async function writeReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: {
    projectId: string;
    agentId: string;
    taskId: string | null;
    title: string;
    summary: string;
    content: string;
  },
): Promise<string | null> {
  const { data } = await supabase
    .from("agent_reports")
    .insert({
      user_id: userId,
      project_id: input.projectId,
      agent_id: input.agentId,
      task_id: input.taskId,
      title: input.title.slice(0, 200),
      summary: input.summary.slice(0, 400),
      content: input.content,
    })
    .select("id")
    .single();

  await logActivity({
    projectId: input.projectId,
    agentId: input.agentId,
    kind: "report_generated",
    message: `New report: ${input.title.slice(0, 120)}`,
  });
  return data?.id ?? null;
}

async function completeTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  taskId: string,
  title: string,
  agentId: string,
  projectId: string,
): Promise<void> {
  await supabase
    .from("agent_tasks")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", userId);
  await logActivity({
    projectId,
    agentId,
    kind: "task_completed",
    message: `Task completed: ${title}`,
  });
}

async function failTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  taskId?: string,
): Promise<void> {
  if (!taskId) return;
  await supabase
    .from("agent_tasks")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
}

async function finishRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  agentId: string,
  projectId: string,
  memory: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("agents")
    .update({
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "active",
      memory,
    })
    .eq("id", agentId)
    .eq("user_id", userId);
}
