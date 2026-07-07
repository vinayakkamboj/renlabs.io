"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { completeAstraText, type ChatMsg } from "@/lib/ai/astra";
import {
  parseFilePatchPlan,
  applyPatchPlan,
  detectFatalIssues,
  describeFatalIssues,
  stubDanglingImports,
  normalizeProjectImports,
} from "@/lib/builder/file-patches";
import {
  hardenGeneratedFiles,
  detectDesignIssues,
  describeDesignIssues,
} from "@/lib/builder/design-lint";
import { isWithinWorkingHours, nextWorkingWindowStart } from "@/lib/data/agents";
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
  /** Set when the run was intentionally not executed (not a failure) —
   *  e.g. an ambient cycle landing outside the agent's working hours. */
  skipped?: "outside_working_hours" | "daily_token_budget";
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
      instructions: agentRow.instructions ?? null,
      focus: agentRow.focus ?? null,
      workingHoursStart: agentRow.working_hours_start ?? null,
      workingHoursEnd: agentRow.working_hours_end ?? null,
      workingDays: agentRow.working_days ?? null,
      timezone: agentRow.timezone ?? "UTC",
      maxTokensPerRun: agentRow.max_tokens_per_run ?? 12000,
      dailyTokenBudget: agentRow.daily_token_budget ?? null,
      tokensSpentToday: agentRow.tokens_spent_today ?? 0,
      tokensTodayDate: agentRow.tokens_today_date ?? null,
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

  // Owner-defined rules and scope — the user's customization of HOW this agent
  // works and WHAT it may touch. Rules outrank defaults; scope is a hard fence.
  const rulesContext = ctx.agent.instructions?.trim()
    ? `\n\n## Owner rules for this agent — follow on EVERY run, they override any default behavior\n${ctx.agent.instructions.trim()}`
    : "";
  const focusContext = ctx.agent.focus?.trim()
    ? `\n\n## Scope\nWork ONLY within this scope: ${ctx.agent.focus.trim()}\nDo not modify or produce anything outside it.`
    : "";

  const userMessage =
    ctx.task?.detail ||
    ctx.task?.title ||
    ctx.agent.goal ||
    preset?.defaultGoal ||
    `Improve and develop the ${ctx.project.name} project.`;

  return [
    {
      role: "user",
      content:
        userMessage +
        rulesContext +
        focusContext +
        businessContext +
        schemaContext +
        fileContext +
        taskContext,
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
  // The cap is the owner's per-run setting, clamped to a range that both
  // finishes in time and can't be set to something useless.
  const perRunCap = Math.min(16_000, Math.max(2_000, ctx.agent.maxTokensPerRun || 12_000));
  const OPTS = { maxTokens: perRunCap, reasoningEffort: "high" } as const;
  let tokensUsed = 0;

  if (!isCodeRole) {
    // Non-code roles: generate a report only
    const messages = await buildPrompt(ctx);
    const prompt = `${buildEditPrompt()}\n\nGenerate a markdown report (2-3 paragraphs) summarizing your assessment and recommendations for the ${ctx.project.name} project.`;

    const result = await completeAstraText(
      [{ ...messages[0], role: "user", content: prompt + "\n" + messages[0].content }],
      { maxTokens: Math.min(2_500, perRunCap), reasoningEffort: "high" },
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
  const plan = parseFilePatchPlan(response.text);
  if (!plan) {
    return {
      plan: "No file changes detected",
      changedFiles: [],
      reportContent: "The agent did not produce any file changes.",
      tokensUsed,
    };
  }

  // Apply patches to create modified file list. Deterministic hardening
  // (bare-import normalization, BrowserRouter → HashRouter) runs before
  // validation so unambiguous bugs never waste the repair pass.
  const finalize = (files: ProjectFile[]) =>
    stubDanglingImports(hardenGeneratedFiles(normalizeProjectImports(files).files).files)
      .files;

  const modified = applyPatchPlan(ctx.files, plan);
  const issues = detectFatalIssues(plan, modified, false);
  // Design lint rides along on the same single repair pass — an agent cycle
  // that ships emoji, hardcoded hex colors, or raw anchors gets one shot at
  // cleaning it up. Only FATAL issues can fail the run afterwards.
  const designIssues = detectDesignIssues(plan, false);

  // The best VALID working state so far + the labels of what was done.
  let working = modified;
  let planLabel = plan.plan;
  const summaries: string[] = [plan.plan];

  // One automatic repair pass
  if (issues.length > 0 || designIssues.length > 0) {
    const issueDesc = [
      issues.length ? describeFatalIssues(issues) : "",
      designIssues.length ? describeDesignIssues(designIssues) : "",
    ]
      .filter(Boolean)
      .join("\n");
    const repairMessages: ChatMsg[] = [
      { role: "system", content: buildRepairPrompt(issueDesc) },
      ...messages,
    ];

    const repairResult = await completeAstraText(repairMessages, OPTS);
    if (!repairResult.ok) throw new Error(`Repair failed: ${repairResult.detail}`);
    tokensUsed +=
      (repairResult.usage?.inputTokens ?? 0) + (repairResult.usage?.outputTokens ?? 0);

    const repairedPlan = parseFilePatchPlan(repairResult.text);
    // The repair may come back worse than the original (or not at all). Fall
    // back to the best VALID candidate instead of throwing the work away:
    // an original with only design nits is still shippable.
    const fallbackOk = issues.length === 0;
    if (repairedPlan) {
      const repaired = applyPatchPlan(ctx.files, repairedPlan);
      const repairedIssues = detectFatalIssues(repairedPlan, repaired, false);
      if (repairedIssues.length === 0) {
        working = repaired;
        planLabel = repairedPlan.plan;
        summaries[0] = repairedPlan.plan;
      } else if (!fallbackOk) {
        throw new Error(`Repair still has issues: ${describeFatalIssues(repairedIssues)}`);
      }
    } else if (!fallbackOk) {
      throw new Error("Repair produced no valid patches");
    }
  }

  // ── DEPTH LOOP — finish the task, don't just touch it ────────────────────
  // The agent reviews its own work against the task and keeps going (bounded)
  // until the task is verifiably complete. This is what makes one cycle
  // implement a task END-TO-END instead of shipping the first shallow patch
  // and waiting for the user to prompt again.
  const deepened = await deepenTask(ctx, working, summaries, tokensUsed, perRunCap);
  working = deepened.files;
  tokensUsed = deepened.tokensUsed;

  return {
    plan: planLabel,
    changedFiles: finalize(working),
    reportContent:
      summaries.length > 1
        ? `Completed in ${summaries.length} passes:\n${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
        : `Applied changes:\n${planLabel}`,
    tokensUsed,
  };
}

/** Extra self-review passes per cycle. Each is a full model call, so this is
 *  deliberately small — depth comes from finishing, not from spinning. */
const MAX_DEPTH_PASSES = 2;
const TASK_COMPLETE_MARKER = "TASK_COMPLETE";

/**
 * Self-review continuation loop: show the agent its own work-in-progress and
 * ask "is the task FULLY done?" — it either declares TASK_COMPLETE or emits
 * only the remaining patches. Three hard bounds keep it safe: pass count,
 * the owner's per-run token cap, and validation (an invalid continuation is
 * dropped and the loop stops at the last good state — it can never regress).
 */
async function deepenTask(
  ctx: AgentContext,
  files: ProjectFile[],
  summaries: string[],
  tokensUsed: number,
  perRunCap: number,
): Promise<{ files: ProjectFile[]; tokensUsed: number }> {
  const taskText =
    ctx.task?.detail || ctx.task?.title || ctx.agent.goal || "Improve the project.";

  let working = files;
  for (let pass = 0; pass < MAX_DEPTH_PASSES; pass++) {
    // Respect the owner's token budget: leave headroom for one more full call.
    if (tokensUsed > perRunCap * 0.7) break;

    // Context: the full path manifest + content of files this cycle touched
    // (bounded), so the reviewer sees its own work without re-sending the repo.
    const touched = working
      .filter((f) => !ctx.files.some((o) => o.path === f.path && o.content === f.content))
      .slice(0, 12);
    const manifest = working.map((f) => f.path).join("\n");
    const touchedBlock = touched
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 6_000)}\n\`\`\``)
      .join("\n\n");

    const review = await completeAstraText(
      [
        { role: "system", content: buildEditPrompt() },
        {
          role: "user",
          content:
            `## Task you are completing\n${taskText}\n\n` +
            `## Work done so far this cycle\n${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
            `## All project files\n${manifest}\n\n` +
            `## Files you changed this cycle\n${touchedBlock}\n\n` +
            `Review your work against the task like a strict senior engineer. Is the task FULLY implemented end-to-end — every screen wired, every referenced file real, states handled, nothing stubbed or half-done?\n` +
            `- If YES: respond with exactly ${TASK_COMPLETE_MARKER} and nothing else.\n` +
            `- If NO: emit ONLY the remaining/incomplete changes as a <file_patches> block. Do not re-emit files that are already correct.`,
        },
      ],
      { maxTokens: Math.min(8_000, perRunCap), reasoningEffort: "high" },
    );
    if (!review.ok) break; // provider hiccup — ship the last good state
    tokensUsed += (review.usage?.inputTokens ?? 0) + (review.usage?.outputTokens ?? 0);

    if (review.text.includes(TASK_COMPLETE_MARKER)) break;

    const contPlan = parseFilePatchPlan(review.text);
    if (!contPlan) break; // no actionable continuation — stop at last good state

    const next = applyPatchPlan(working, contPlan);
    const contIssues = detectFatalIssues(contPlan, next, false);
    if (contIssues.length > 0) break; // invalid continuation — never regress

    working = next;
    summaries.push(contPlan.plan || "Continued the task");
  }

  return { files: working, tokensUsed };
}

/**
 * Autonomy bootstrap: an agent with an empty queue writes its OWN backlog
 * from the project brief, goals, and codebase — then immediately starts on
 * the first item. Combined with reflectAndQueueTasks (which queues follow-ups
 * after every cycle), the loop feeds itself: the user sets the goal once and
 * never has to prompt task-by-task.
 */
async function bootstrapBacklog(
  ctx: AgentContext,
): Promise<{ task: AgentTask | null; tokensUsed: number }> {
  const preset = ROLE_PRESETS[ctx.agent.role];
  const goal = ctx.agent.goal || preset?.defaultGoal || `Improve the ${ctx.project.name} project.`;
  const manifest = ctx.files.map((f) => f.path).join("\n") || "(empty project)";

  const result = await completeAstraText(
    [
      {
        role: "user",
        content:
          `You are ${ctx.agent.name}, the ${preset?.label ?? ctx.agent.role} on the "${ctx.project.name}" project.` +
          buildBusinessContext(ctx) +
          (ctx.agent.focus ? `\nYour scope: ${ctx.agent.focus}` : "") +
          `\n\nYour standing goal: ${goal}\n\nProject files:\n${manifest}\n\n` +
          `Write your own work backlog: the 3-5 most valuable, CONCRETE tasks (each completable in one focused session) that advance the goal from the project's current state. Order by priority.\n` +
          `Return ONLY a JSON array like: [{"title": "short imperative title", "detail": "2-3 sentences: exactly what to build/change and what done looks like"}]`,
      },
    ],
    { maxTokens: 900, reasoningEffort: "low" },
  );
  if (!result.ok) return { task: null, tokensUsed: 0 };
  const tokensUsed =
    (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0);

  let items: { title: string; detail?: string }[] = [];
  try {
    const match = result.text.match(/\[[\s\S]*\]/);
    if (match) {
      items = (JSON.parse(match[0]) as unknown[])
        .map((t) =>
          typeof t === "string"
            ? { title: t }
            : (t as { title?: string; detail?: string }),
        )
        .filter((t): t is { title: string; detail?: string } =>
          Boolean(t && typeof t.title === "string" && t.title.trim()),
        )
        .slice(0, 5);
    }
  } catch {
    /* unparseable backlog — the run falls back to goal-driven mode */
  }
  if (!items.length) return { task: null, tokensUsed };

  let firstTask: AgentTask | null = null;
  for (let i = 0; i < items.length; i++) {
    const { data } = await ctx.supabase
      .from("agent_tasks")
      .insert({
        user_id: ctx.userId,
        project_id: ctx.project.id,
        agent_id: ctx.agent.id,
        title: items[i].title.trim().slice(0, 200),
        detail: items[i].detail?.trim().slice(0, 1_000) || null,
        status: "queued",
        priority: i === 0 ? "high" : "medium",
      })
      .select("*")
      .single();
    if (i === 0 && data) {
      firstTask = {
        id: data.id,
        projectId: data.project_id,
        agentId: data.agent_id,
        title: data.title,
        detail: data.detail ?? null,
        status: data.status,
        priority: data.priority,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        completedAt: null,
      };
    }
  }

  if (firstTask) {
    await logActivity({
      projectId: ctx.project.id,
      agentId: ctx.agent.id,
      kind: "task_created",
      message: `${ctx.agent.name} planned its own backlog (${items.length} tasks) and started: ${firstTask.title}`,
    });
  }
  return { task: firstTask, tokensUsed };
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
  opts?: {
    /** True when the scheduler (cron/tick) triggered this run — working-hours
     *  windows apply. Manual "Run now" clicks bypass hours (the owner is right
     *  there asking) but never the daily token budget. */
    ambient?: boolean;
  },
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

    const now = new Date();

    // ── Working hours ────────────────────────────────────────────────────────
    // Ambient cycles only run inside the owner's configured window. A skip is
    // NOT a failure: park next_run_at at the window's next opening and leave.
    if (opts?.ambient && !isWithinWorkingHours(ctx.agent, now)) {
      const resume = nextWorkingWindowStart(ctx.agent, now);
      await ctx.supabase
        .from("agents")
        .update({ next_run_at: resume.toISOString() })
        .eq("id", ctx.agent.id);
      return { ok: true, skipped: "outside_working_hours" };
    }

    // ── Daily token budget ───────────────────────────────────────────────────
    // Hard cap on tokens/day, enforced for ambient AND manual runs. The counter
    // rolls over by UTC date; when exhausted, the loop sleeps to next midnight.
    const today = now.toISOString().slice(0, 10);
    const spentToday = ctx.agent.tokensTodayDate === today ? ctx.agent.tokensSpentToday : 0;
    if (ctx.agent.dailyTokenBudget && spentToday >= ctx.agent.dailyTokenBudget) {
      const midnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      );
      await ctx.supabase
        .from("agents")
        .update({ next_run_at: midnight.toISOString() })
        .eq("id", ctx.agent.id);
      if (opts?.ambient) return { ok: true, skipped: "daily_token_budget" };
      return {
        ok: false,
        error: `This agent hit its daily token budget (${ctx.agent.dailyTokenBudget.toLocaleString()} tokens). It resumes at midnight UTC, or raise the budget in its settings.`,
      };
    }

    // ── Autonomy bootstrap ───────────────────────────────────────────────────
    // Empty queue? The agent plans its OWN backlog from the goal + project
    // state and starts on the first item — the user never has to feed it
    // task-by-task. (Cheap planning call; if it yields nothing, code roles
    // still run goal-driven, non-code roles genuinely have nothing to do.)
    let bootstrapTokens = 0;
    if (!ctx.task) {
      const boot = await bootstrapBacklog(ctx);
      bootstrapTokens = boot.tokensUsed;
      if (boot.task) ctx.task = boot.task;
      else if (!["developer", "qa", "design", "ops"].includes(ctx.agent.role)) {
        return { ok: false, error: "No task queued for this agent" };
      }
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
    const exec = await executeAgent(ctx);
    const { plan, changedFiles, reportContent } = exec;
    const tokensUsed = exec.tokensUsed + bootstrapTokens;

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
    // Throttle-scheduled next run — but never inside a closed working window,
    // and never past an exhausted daily budget (sleep to UTC midnight instead).
    let nextRun = new Date(Date.now() + delayMinutes * 60_000);
    const newSpentToday = spentToday + tokensUsed;
    if (ctx.agent.dailyTokenBudget && newSpentToday >= ctx.agent.dailyTokenBudget) {
      nextRun = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      );
    } else if (!isWithinWorkingHours(ctx.agent, nextRun)) {
      nextRun = nextWorkingWindowStart(ctx.agent, nextRun);
    }
    await ctx.supabase
      .from("agents")
      .update({
        last_run_at: new Date().toISOString(),
        spent_cents: ctx.agent.spentCents + creditsSpent,
        next_run_at: nextRun.toISOString(),
        consecutive_failures: 0,
        tokens_spent_today: newSpentToday,
        tokens_today_date: today,
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
