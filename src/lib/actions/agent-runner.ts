"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { streamAstraText, type ChatMsg } from "@/lib/ai/astra";
import {
  parseFilePatchPlan,
  applyPatchPlan,
  detectFatalIssues,
  describeFatalIssues,
} from "@/lib/builder/file-patches";
import { buildEditPrompt, buildRepairPrompt } from "@/lib/builder/prompts";
import { logActivity, setTaskStatus } from "./agents";
import { ROLE_PRESETS } from "@/lib/data/agents";
import type { Agent, AgentTask, TaskStatus, TaskPriority } from "@/lib/data/agents";
import type { ProjectFile } from "@/lib/builder/types";

export interface RunAgentTaskResult {
  ok: boolean;
  error?: string;
  filesChanged?: number;
  followUpTasks?: number;
  reportId?: string;
}

interface AgentContext {
  userId: string;
  agent: Agent;
  project: { id: string; name: string };
  task: AgentTask | null;
  files: ProjectFile[];
  supabase: ReturnType<typeof createAdminClient>;
}

async function loadContext(agentId: string, taskId?: string): Promise<AgentContext | null> {
  const supabase = createAdminClient();

  const { data: agentRow, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (agentError || !agentRow) return null;

  const userId = agentRow.user_id as string;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", agentRow.project_id)
    .single();

  if (projectError || !project) return null;

  // Helper to map task rows to AgentTask
  const mapTask = (row: Record<string, unknown>): AgentTask => ({
    id: row.id as string,
    projectId: row.project_id as string,
    agentId: (row.agent_id as string) || null,
    title: row.title as string,
    detail: (row.detail as string) || null,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string) || null,
  });

  // Pick a task: if taskId provided, use it; else find first queued task assigned to this agent
  let task: AgentTask | null = null;
  if (taskId) {
    const { data: specificTask } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("agent_id", agentId)
      .single();
    task = specificTask ? mapTask(specificTask) : null;
  } else {
    const { data: tasks } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("agent_id", agentId)
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);
    task = tasks?.[0] ? mapTask(tasks[0]) : null;
  }

  // Load project files
  const { data: files, error: filesError } = await supabase
    .from("project_files")
    .select("id, path, content, language")
    .eq("project_id", agentRow.project_id)
    .order("path");

  if (filesError) return null;

  return {
    agent: {
      id: agentRow.id,
      projectId: agentRow.project_id,
      name: agentRow.name,
      role: agentRow.role,
      goal: agentRow.goal,
      status: agentRow.status,
      schedule: agentRow.schedule ?? "manual",
      budgetCents: agentRow.budget_cents ?? 0,
      spentCents: agentRow.spent_cents ?? 0,
      permissions: agentRow.permissions ?? [],
      lastRunAt: agentRow.last_run_at,
      createdAt: agentRow.created_at,
      updatedAt: agentRow.updated_at,
    },
    project: { id: project.id, name: project.name },
    task,
    files: files || [],
    userId,
    supabase,
  };
}

async function saveFiles(
  userId: string,
  projectId: string,
  files: ProjectFile[],
  supabase: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  try {
    for (const file of files) {
      await supabase.from("project_files").upsert(
        {
          user_id: userId,
          project_id: projectId,
          path: file.path,
          content: file.content,
          language: file.language || detectLanguage(file.path),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,path" },
      );
    }
    return true;
  } catch {
    return false;
  }
}

function detectLanguage(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    css: "css",
    html: "html",
    json: "json",
  };
  return langMap[ext || ""] || null;
}

async function buildPrompt(ctx: AgentContext): Promise<ChatMsg[]> {
  const preset = ROLE_PRESETS[ctx.agent.role];

  // For code-generating roles, build files context
  const isCodeRole = ["developer", "qa", "design", "ops"].includes(ctx.agent.role);
  const fileContext = isCodeRole
    ? `\n\n## Current project files\n\`\`\`\n${ctx.files.map((f) => `${f.path}:\n${f.content}`).join("\n\n")}\n\`\`\``
    : "";

  const taskContext = ctx.task ? `\nCurrent task: ${ctx.task.title}${ctx.task.detail ? `\n${ctx.task.detail}` : ""}` : "";

  const userMessage =
    ctx.task?.detail ||
    ctx.task?.title ||
    ctx.agent.goal ||
    preset?.defaultGoal ||
    `Improve and develop the ${ctx.project.name} project.`;

  return [
    {
      role: "user",
      content: userMessage + fileContext + taskContext,
    },
  ];
}

async function executeAgent(ctx: AgentContext): Promise<{
  plan: string;
  changedFiles: ProjectFile[];
  reportContent: string;
}> {
  const isCodeRole = ["developer", "qa", "design", "ops"].includes(ctx.agent.role);

  if (!isCodeRole) {
    // Non-code roles: generate a report only
    const messages = await buildPrompt(ctx);
    const prompt = `${buildEditPrompt()}\n\nGenerate a markdown report (2-3 paragraphs) summarizing your assessment and recommendations for the ${ctx.project.name} project.`;

    const result = await streamAstraText([{ ...messages[0], role: "user", content: prompt + "\n" + messages[0].content }]);
    if (!result.ok) throw new Error(`Astra error: ${result.detail}`);

    // Drain stream to string
    const content = await drainStream(result.stream);

    return {
      plan: "Report generated",
      changedFiles: [],
      reportContent: content,
    };
  }

  // Code roles: generate file patches, with one automatic repair pass
  const messages = await buildPrompt(ctx);
  const systemPrompt = buildEditPrompt();

  const response = await streamAstraText([
    { role: "system", content: systemPrompt },
    ...messages,
  ]);

  if (!response.ok) throw new Error(`Astra error: ${response.detail}`);

  let content = await drainStream(response.stream);

  // Parse and validate
  let plan = parseFilePatchPlan(content);
  if (!plan) {
    return {
      plan: "No file changes detected",
      changedFiles: [],
      reportContent: "The agent did not produce any file changes.",
    };
  }

  // Apply patches to create modified file list
  const modified = applyPatchPlan(ctx.files, plan);
  let issues = detectFatalIssues(plan, modified, false);

  // One automatic repair pass
  if (issues.length > 0) {
    const issueDesc = describeFatalIssues(issues);
    const repairMessages: ChatMsg[] = [
      { role: "system", content: buildRepairPrompt(issueDesc) },
      ...messages,
    ];

    const repairResult = await streamAstraText(repairMessages);
    if (!repairResult.ok) throw new Error(`Repair failed: ${repairResult.detail}`);

    content = await drainStream(repairResult.stream);
    plan = parseFilePatchPlan(content);
    if (!plan) throw new Error("Repair produced no valid patches");

    const repaired = applyPatchPlan(ctx.files, plan);
    issues = detectFatalIssues(plan, repaired, false);
    if (issues.length > 0) throw new Error(`Repair still has issues: ${describeFatalIssues(issues)}`);

    return {
      plan: plan.plan,
      changedFiles: repaired,
      reportContent: `Repaired and applied changes:\n${plan.plan}`,
    };
  }

  return {
    plan: plan.plan,
    changedFiles: modified,
    reportContent: `Applied changes:\n${plan.plan}`,
  };
}

async function reflectAndQueueTasks(
  ctx: AgentContext,
  changedFiles: ProjectFile[],
): Promise<string[]> {
  if (!["developer", "qa", "design"].includes(ctx.agent.role)) return [];

  // Call Astra to read the changed project and suggest follow-up tasks
  const fileSnippet = changedFiles
    .slice(0, 5)
    .map((f) => `${f.path}: ${f.content.slice(0, 300)}...`)
    .join("\n");

  const messages: ChatMsg[] = [
    {
      role: "user",
      content: `Based on these changes to the ${ctx.project.name} project:\n\n${fileSnippet}\n\nSuggest 1-3 concrete next tasks to continue development. Return ONLY a JSON array of task titles, like: ["Add user authentication", "Implement database schema", "Create dashboard page"]`,
    },
  ];

  const result = await streamAstraText(messages);
  if (!result.ok) return [];

  const content = await drainStream(result.stream);

  // Extract JSON array
  let tasks: string[] = [];
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      tasks = JSON.parse(match[0]).filter((t: unknown) => typeof t === "string").slice(0, 3);
    }
  } catch {
    // ignore parse errors
  }

  // Insert tasks
  const createdIds: string[] = [];
  for (const title of tasks) {
    const { data, error } = await ctx.supabase
      .from("agent_tasks")
      .insert({
        user_id: ctx.userId,
        project_id: ctx.project.id,
        agent_id: ctx.agent.id,
        title,
        status: "queued",
        priority: "medium",
      })
      .select("id");

    if (!error && Array.isArray(data) && data[0]) {
      createdIds.push((data[0] as { id: string }).id);
    }
  }

  return createdIds;
}

async function drainStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }
  } finally {
    reader.releaseLock();
  }

  return chunks.join("");
}

/**
 * Execute one autonomous run of an agent: pick a task, make code/report changes,
 * queue follow-up work, and persist everything.
 */
export async function runAgentTask(
  agentId: string,
  taskId?: string,
): Promise<RunAgentTaskResult> {
  try {
    // Load context
    const ctx = await loadContext(agentId, taskId);
    if (!ctx) {
      return { ok: false, error: "Agent or project not found" };
    }

    // If no task and not code-generating, nothing to do
    if (!ctx.task && !["developer", "qa", "design", "ops"].includes(ctx.agent.role)) {
      return { ok: false, error: "No task queued for this agent" };
    }

    // Execute
    const { plan, changedFiles, reportContent } = await executeAgent(ctx);

    // Save files
    if (changedFiles.length > 0) {
      const saved = await saveFiles(ctx.userId, ctx.project.id, changedFiles, ctx.supabase);
      if (!saved) {
        return { ok: false, error: "Failed to save files" };
      }
    }

    // Mark task in progress then done
    if (ctx.task) {
      await setTaskStatus(ctx.task.id, "in_progress");
      await setTaskStatus(ctx.task.id, "done");
    }

    // Write report
    const { data: reportData } = await ctx.supabase
      .from("agent_reports")
      .insert({
        user_id: ctx.userId,
        project_id: ctx.project.id,
        agent_id: ctx.agent.id,
        task_id: ctx.task?.id || null,
        title: plan,
        content: reportContent,
      })
      .select("id")
      .single();

    const reportId = reportData?.id;

    // Reflect and queue follow-ups
    const followUpIds = await reflectAndQueueTasks(ctx, changedFiles);

    // Update agent lastRunAt and memory
    await ctx.supabase
      .from("agents")
      .update({
        last_run_at: new Date().toISOString(),
        memory: {
          lastTask: ctx.task?.id,
          lastChangedFiles: changedFiles.map((f) => f.path),
          lastReportId: reportId,
        },
      })
      .eq("id", ctx.agent.id);

    // Log activity
    await logActivity({
      projectId: ctx.project.id,
      agentId: ctx.agent.id,
      kind: "report_generated",
      message: `${ctx.agent.name} completed a run: ${plan}`,
    });

    return {
      ok: true,
      filesChanged: changedFiles.length,
      followUpTasks: followUpIds.length,
      reportId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
