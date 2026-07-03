"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { completeAstraText, type ChatMsg } from "@/lib/ai/astra";
import {
  parseFilePatchPlan,
  applyPatchPlan,
  detectFatalIssues,
  describeFatalIssues,
  stubDanglingImports,
} from "@/lib/builder/file-patches";
import { buildEditPrompt, buildRepairPrompt } from "@/lib/builder/prompts";
import { logActivity, setTaskStatus } from "./agents";
import { deductAgentRunCredits } from "@/lib/credits/server";
import { CREDITS_PER_AGENT_RUN } from "@/lib/credits/config";
import { ROLE_PRESETS } from "@/lib/data/agents";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { Agent, AgentTask, TaskStatus, TaskPriority } from "@/lib/data/agents";
import type { ProjectFile } from "@/lib/builder/types";

export interface RunAgentTaskResult {
  ok: boolean;
  error?: string;
  filesChanged?: number;
  followUpTasks?: number;
  reportId?: string;
  /** One-line summary of what the agent did this run (the report title). */
  plan?: string;
  /** Ren credits this run charged to the owner's balance. */
  creditsSpent?: number;
  /** Owner's credit balance after this run (when known). */
  creditsBalance?: number;
}

interface AgentContext {
  userId: string;
  agent: Agent;
  project: { id: string; name: string; brief: string | null; goals: string[] };
  task: AgentTask | null;
  files: ProjectFile[];
  /** A short description of the project's connected Supabase schema, if any. */
  schemaSummary: string | null;
  supabase: ReturnType<typeof createAdminClient>;
}

/**
 * Read the project's connected Supabase backend (via the admin client, since the
 * runner has no user session) and summarize its tables/columns for the model.
 * Returns null when no backend is connected. Credentials are decrypted only here
 * and never leave the server.
 */
async function loadSchemaSummary(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  projectId: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("user_integrations")
      .select("config")
      .eq("user_id", userId)
      .eq("kind", "supabase")
      .eq("project_id", projectId)
      .maybeSingle();
    if (!data) return null;

    const cfg = data.config as Record<string, string>;
    const projectUrl = cfg.project_url ?? "";
    const key = decryptSecret(cfg.service_role_key ?? "") || decryptSecret(cfg.anon_key ?? "");
    if (!projectUrl || !key) return null;

    const res = await fetch(`${projectUrl}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const spec = (await res.json()) as {
      definitions?: Record<string, { properties?: Record<string, { type?: string; format?: string }> }>;
    };
    const tables = Object.entries(spec.definitions ?? {});
    if (tables.length === 0) return null;

    const lines = tables.map(([name, def]) => {
      const cols = Object.entries(def.properties ?? {})
        .map(([col, info]) => `${col} ${info.format ?? info.type ?? "unknown"}`)
        .join(", ");
      return `- ${name}(${cols})`;
    });
    return `The project is connected to a Supabase backend with this schema:\n${lines.join("\n")}`;
  } catch {
    return null;
  }
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
    .select("id, name, brief, goals")
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
    .eq("branch", "main")
    .order("path");

  if (filesError) return null;

  // Load the project's connected Supabase schema (if any) for grounding.
  const schemaSummary = await loadSchemaSummary(supabase, userId, agentRow.project_id);

  return {
    schemaSummary,
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
      loopEnabled: agentRow.loop_enabled ?? false,
      rateTokensPerMin: agentRow.rate_tokens_per_min ?? 1500,
      nextRunAt: agentRow.next_run_at ?? null,
      consecutiveFailures: agentRow.consecutive_failures ?? 0,
    },
    project: {
      id: project.id,
      name: project.name,
      brief: (project.brief as string) ?? null,
      goals: (project.goals as string[]) ?? [],
    },
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
    // Agents never write to main. Their work lands on the 'ren' branch, and
    // the user promotes it to main explicitly after review — a bad cycle can
    // never damage the live app.
    const rows = files.map((file) => ({
      user_id: userId,
      project_id: projectId,
      path: file.path,
      content: file.content,
      language: file.language || detectLanguage(file.path),
      branch: "ren",
      updated_at: new Date().toISOString(),
    }));
    await supabase
      .from("project_files")
      .upsert(rows, { onConflict: "project_id,path,branch" });
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

/**
 * The shared "business context" every agent in a workspace reads, so an engineer,
 * QA, designer, or ops agent all operate from the same understanding of what the
 * business is, who it serves, and what it's trying to achieve.
 */
function buildBusinessContext(ctx: AgentContext): string {
  const parts: string[] = [];
  if (ctx.project.brief?.trim()) {
    parts.push(ctx.project.brief.trim());
  }
  if (ctx.project.goals?.length) {
    parts.push(
      `Current goals:\n${ctx.project.goals.map((g) => `- ${g}`).join("\n")}`,
    );
  }
  if (!parts.length) return "";
  return (
    `\n\n## Business context — "${ctx.project.name}"\n` +
    parts.join("\n\n") +
    `\nYou are part of an autonomous team building this product. Make decisions ` +
    `that serve the business above, coordinate implicitly with the other roles, ` +
    `and keep everything consistent with these goals.`
  );
}

async function buildPrompt(ctx: AgentContext): Promise<ChatMsg[]> {
  const preset = ROLE_PRESETS[ctx.agent.role];

  // For code-generating roles, build files context
  const isCodeRole = ["developer", "qa", "design", "ops"].includes(ctx.agent.role);
  const fileContext = isCodeRole
    ? `\n\n## Current project files\n\`\`\`\n${ctx.files.map((f) => `${f.path}:\n${f.content}`).join("\n\n")}\n\`\`\``
    : "";

  const taskContext = ctx.task ? `\nCurrent task: ${ctx.task.title}${ctx.task.detail ? `\n${ctx.task.detail}` : ""}` : "";

  // Ground the model in the project's real backend schema when one is connected.
  const schemaContext = ctx.schemaSummary
    ? `\n\n## Connected backend\n${ctx.schemaSummary}\nWrite queries and types that match this schema exactly.`
    : "";

  // The business brief + goals — what makes each agent understand the business.
  const businessContext = buildBusinessContext(ctx);

  const userMessage =
    ctx.task?.detail ||
    ctx.task?.title ||
    ctx.agent.goal ||
    preset?.defaultGoal ||
    `Improve and develop the ${ctx.project.name} project.`;

  return [
    {
      role: "user",
      content: userMessage + businessContext + schemaContext + fileContext + taskContext,
    },
  ];
}

async function executeAgent(ctx: AgentContext): Promise<{
  plan: string;
  changedFiles: ProjectFile[];
  reportContent: string;
  tokensUsed: number;
}> {
  const isCodeRole = ["developer", "qa", "design", "ops"].includes(ctx.agent.role);
  // Bounded per-cycle budget + explicit reasoning level — without these, GLM
  // runs at max reasoning against a tiny default cap and produces nothing.
  const OPTS = { maxTokens: 12_000, reasoningEffort: "high" } as const;
  let tokensUsed = 0;

  if (!isCodeRole) {
    // Non-code roles: generate a report only
    const messages = await buildPrompt(ctx);
    const prompt = `${buildEditPrompt()}\n\nGenerate a markdown report (2-3 paragraphs) summarizing your assessment and recommendations for the ${ctx.project.name} project.`;

    const result = await completeAstraText(
      [{ ...messages[0], role: "user", content: prompt + "\n" + messages[0].content }],
      { maxTokens: 2_500, reasoningEffort: "high" },
    );
    if (!result.ok) throw new Error(`Astra error: ${result.detail}`);
    tokensUsed += (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0);

    return {
      plan: "Report generated",
      changedFiles: [],
      reportContent: result.text,
      tokensUsed,
    };
  }

  // Code roles: generate file patches, with one automatic repair pass
  const messages = await buildPrompt(ctx);
  const systemPrompt = buildEditPrompt();

  const response = await completeAstraText(
    [{ role: "system", content: systemPrompt }, ...messages],
    OPTS,
  );
  if (!response.ok) throw new Error(`Astra error: ${response.detail}`);
  tokensUsed += (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0);

  // Parse and validate
  let plan = parseFilePatchPlan(response.text);
  if (!plan) {
    return {
      plan: "No file changes detected",
      changedFiles: [],
      reportContent: "The agent did not produce any file changes.",
      tokensUsed,
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

    const repairResult = await completeAstraText(repairMessages, OPTS);
    if (!repairResult.ok) throw new Error(`Repair failed: ${repairResult.detail}`);
    tokensUsed +=
      (repairResult.usage?.inputTokens ?? 0) + (repairResult.usage?.outputTokens ?? 0);

    plan = parseFilePatchPlan(repairResult.text);
    if (!plan) throw new Error("Repair produced no valid patches");

    const repaired = applyPatchPlan(ctx.files, plan);
    issues = detectFatalIssues(plan, repaired, false);
    if (issues.length > 0) throw new Error(`Repair still has issues: ${describeFatalIssues(issues)}`);

    return {
      plan: plan.plan,
      changedFiles: stubDanglingImports(repaired).files,
      reportContent: `Repaired and applied changes:\n${plan.plan}`,
      tokensUsed,
    };
  }

  return {
    plan: plan.plan,
    changedFiles: stubDanglingImports(modified).files,
    reportContent: `Applied changes:\n${plan.plan}`,
    tokensUsed,
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

  const result = await completeAstraText(messages, {
    maxTokens: 400,
    reasoningEffort: "high",
  });
  if (!result.ok) return [];

  const content = result.text;

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

/**
 * Execute one autonomous run of an agent: pick a task, make code/report changes,
 * queue follow-up work, and persist everything.
 */
export async function runAgentTask(
  agentId: string,
  taskId?: string,
  requesterId?: string,
): Promise<RunAgentTaskResult> {
  try {
    // Load context
    const ctx = await loadContext(agentId, taskId);
    if (!ctx) {
      return { ok: false, error: "Agent or project not found" };
    }

    // Ownership: when a requester is known (a real signed-in user triggered this),
    // only the agent's owner may run it — runs spend the owner's credits.
    if (requesterId && requesterId !== ctx.userId) {
      return { ok: false, error: "You don't have access to this agent." };
    }

    // If no task and not code-generating, nothing to do
    if (!ctx.task && !["developer", "qa", "design", "ops"].includes(ctx.agent.role)) {
      return { ok: false, error: "No task queued for this agent" };
    }

    // ── Credit budget ────────────────────────────────────────────────────────
    // Each run is charged to the owner's Ren credit balance. A positive per-agent
    // budget caps how much of that balance this one agent may spend.
    const cost = CREDITS_PER_AGENT_RUN;
    if (ctx.agent.budgetCents > 0 && ctx.agent.spentCents + cost > ctx.agent.budgetCents) {
      // Out of budget: stop the ambient loop too, so it doesn't spin on refusals.
      await ctx.supabase
        .from("agents")
        .update({ loop_enabled: false })
        .eq("id", ctx.agent.id);
      return {
        ok: false,
        error:
          "This agent has reached its credit budget. Raise its budget to keep it running.",
      };
    }
    const charge = await deductAgentRunCredits(ctx.userId, ctx.project.id, cost);
    if (!charge.ok) {
      if (charge.error === "insufficient_credits") {
        return {
          ok: false,
          error: "Out of Ren credits — top up in Billing to keep your agents running.",
        };
      }
      return { ok: false, error: "Couldn't reserve credits for this run." };
    }
    // "skipped" means the credits table/RPC isn't set up (dev) — run for free then.
    const creditsSpent = "skipped" in charge ? 0 : cost;
    const creditsBalance = "skipped" in charge ? undefined : charge.balance;

    // Execute
    const { plan, changedFiles, reportContent, tokensUsed } = await executeAgent(ctx);

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

    // Update agent lastRunAt, memory, spend — and the burn-rate schedule.
    // rate_tokens_per_min is the throttle: an agent that used 6k tokens at a
    // 2k/min rate sleeps ~3 minutes before its next ambient cycle. Successful
    // cycles reset the failure counter.
    const rate = Math.max(200, ctx.agent.rateTokensPerMin);
    const delayMinutes = Math.max(1, Math.ceil(tokensUsed / rate));
    await ctx.supabase
      .from("agents")
      .update({
        last_run_at: new Date().toISOString(),
        spent_cents: ctx.agent.spentCents + creditsSpent,
        next_run_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        consecutive_failures: 0,
        memory: {
          lastTask: ctx.task?.id,
          lastChangedFiles: changedFiles.map((f) => f.path),
          lastReportId: reportId,
          lastTokensUsed: tokensUsed,
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
      plan,
      creditsSpent,
      creditsBalance,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Track consecutive failures; three in a row pauses the ambient loop so a
    // stuck agent can't burn tokens repeating the same mistake.
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("agents")
        .select("consecutive_failures")
        .eq("id", agentId)
        .single();
      const failures = ((data?.consecutive_failures as number) ?? 0) + 1;
      await supabase
        .from("agents")
        .update({
          consecutive_failures: failures,
          next_run_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          ...(failures >= 3 ? { loop_enabled: false, status: "paused" } : {}),
        })
        .eq("id", agentId);
    } catch {
      /* accounting is best-effort */
    }
    return { ok: false, error: msg };
  }
}
