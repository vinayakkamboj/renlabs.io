/**
 * Server-side build job runner — chained agentic steps.
 *
 * A build is Anthropic's evaluator-optimizer loop (generate → verify →
 * repair/continue), but each serverless invocation runs exactly ONE pass and
 * then triggers the next invocation over HTTP. No single function run comes
 * near the platform's time limit, so long multi-pass builds can't be killed
 * mid-loop — the failure mode behind "the build worker went quiet".
 *
 * Smart sizing: small edit requests get a small token budget and at most two
 * passes (fast + cheap); big first builds get the full budget and pass count.
 *
 * All state lives on the build_jobs row (state jsonb + steps feed), and files
 * persist to project_files after every pass. NEVER import from a client
 * component.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { completeAstraText } from "@/lib/ai/astra";
import {
  buildNewProjectPrompt,
  buildEditPrompt,
  buildRepairPrompt,
} from "./prompts";
import { buildContextPack } from "./context";
import {
  parseFilePatchPlan,
  applyPatchPlan,
  detectFatalIssues,
  describeFatalIssues,
  stubDanglingImports,
  isCodePath,
  isCodeFileComplete,
} from "./file-patches";
import { createBaseTemplate } from "./base-template";
import type { ProjectFile } from "./types";

type Supa = ReturnType<typeof createAdminClient>;

interface JobRow {
  id: string;
  user_id: string;
  project_id: string;
  status: string;
  cancelled: boolean;
  prompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  is_first_build: boolean;
  changed_paths: string[] | null;
  input_tokens: number;
  output_tokens: number;
  state: JobState | null;
}

/** Loop state carried between chained invocations. */
interface JobState {
  pass?: number;
  big?: boolean;
  appWritten?: boolean;
  repairNote?: string;
  retried?: boolean;
  lockUntil?: number;
  planSummary?: string;
  stubbedCount?: number;
}

interface Step {
  t: number;
  kind: "thinking" | "writing" | "verifying" | "repairing" | "applying" | "info" | "error";
  text: string;
}

const FORMAT_NOTE =
  "Output the application NOW as a single <file_patches> JSON block with the FULL contents of every file. No prose, no questions — only the block.";

async function log(
  supabase: Supa,
  jobId: string,
  step: Omit<Step, "t">,
  status?: string,
) {
  const { data } = await supabase
    .from("build_jobs")
    .select("steps")
    .eq("id", jobId)
    .single();
  const steps = ((data?.steps ?? []) as Step[]).concat({ t: Date.now(), ...step });
  await supabase
    .from("build_jobs")
    .update({
      steps,
      updated_at: new Date().toISOString(),
      ...(status ? { status } : {}),
    })
    .eq("id", jobId);
}

async function saveState(supabase: Supa, jobId: string, state: JobState) {
  await supabase
    .from("build_jobs")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function loadProjectFiles(supabase: Supa, projectId: string): Promise<ProjectFile[]> {
  const { data } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId)
    .eq("branch", "main")
    .order("path");
  return (data ?? []) as ProjectFile[];
}

async function saveProjectFiles(
  supabase: Supa,
  userId: string,
  projectId: string,
  files: ProjectFile[],
): Promise<void> {
  const rows = files.map((f) => ({
    user_id: userId,
    project_id: projectId,
    path: f.path,
    content: f.content,
    branch: "main",
    updated_at: new Date().toISOString(),
  }));
  await supabase.from("project_files").upsert(rows, { onConflict: "project_id,path,branch" });
}

/**
 * Hand off to the next pass as a fresh invocation. Retries a couple of times
 * (the internal request can transiently fail on a cold start), and — this
 * used to just swallow any failure, which silently killed the whole chain
 * with zero trace and read to the user as "the build worker went quiet" —
 * now marks the job as errored with the real HTTP status/body if every
 * attempt fails, so a broken handoff (bad NEXT_PUBLIC_APP_URL, deployment
 * protection blocking internal requests, etc.) is visible instead of silent.
 */
async function chainNext(supabase: Supa, jobId: string, origin: string): Promise<void> {
  let lastDetail = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${origin}/api/builder/jobs/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (res.ok) return;
      lastDetail = `${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`;
    } catch (e) {
      lastDetail = e instanceof Error ? e.message : String(e);
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  await supabase
    .from("build_jobs")
    .update({
      status: "error",
      error: `Could not hand off to the next build step (${lastDetail || "unknown error"}). Check NEXT_PUBLIC_APP_URL is set to your real deployment URL and that /api/builder/jobs/step isn't blocked by deployment protection.`,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

/** Does this request need the big budget, or is it a quick change? */
function classifyBig(prompt: string, firstBuild: boolean): boolean {
  if (firstBuild) return true;
  if (prompt.length > 160) return true;
  return /\b(game|clone|rebuild|redesign|entire|whole app|all pages|full|website|dashboard|landing page)\b/i.test(
    prompt,
  );
}

/**
 * Run ONE pass of a build job, then either finish or chain the next pass.
 * Safe to call repeatedly: terminal/locked jobs are no-ops.
 */
export async function runBuildStep(jobId: string, origin: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: jobData, error: fetchError } = await supabase
    .from("build_jobs")
    .select(
      "id, user_id, project_id, status, cancelled, prompt, messages, is_first_build, changed_paths, input_tokens, output_tokens, state",
    )
    .eq("id", jobId)
    .single();

  // A query error here (e.g. the `state` column missing because migration
  // 20260704_build_jobs_state.sql hasn't been applied) used to be swallowed —
  // the function returned silently and the job sat frozen forever with no
  // diagnostic, which read to the user as "the build worker went quiet".
  // Surface it loudly instead: mark the job as errored with the real reason.
  if (fetchError) {
    await supabase
      .from("build_jobs")
      .update({
        status: "error",
        error: `Could not load the build job: ${fetchError.message}. If this mentions a missing column, a database migration hasn't been applied yet (check supabase/migrations/20260704_build_jobs_state.sql).`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return;
  }
  if (!jobData) return; // job row genuinely doesn't exist — nothing to run

  const job = jobData as JobRow;

  // Terminal states are final — a stray chained call must not restart work.
  if (["done", "error", "cancelled"].includes(job.status)) return;

  if (job.cancelled) {
    await log(supabase, jobId, { kind: "info", text: "Cancelled by user" });
    await supabase
      .from("build_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", jobId);
    return;
  }

  const state: JobState = { ...(job.state ?? {}) };

  // Re-entrancy lock: one pass at a time (a duplicate chained call or a
  // client retry must not run two model calls concurrently).
  if (state.lockUntil && state.lockUntil > Date.now()) return;
  state.lockUntil = Date.now() + 270_000;
  await saveState(supabase, jobId, state);

  const fail = async (message: string) => {
    await log(supabase, jobId, { kind: "error", text: message });
    await supabase
      .from("build_jobs")
      .update({ status: "error", error: message, completed_at: new Date().toISOString() })
      .eq("id", jobId);
  };

  try {
    const pass = state.pass ?? 0;
    let files = await loadProjectFiles(supabase, job.project_id);
    const firstBuild = (job.is_first_build || files.length === 0) && !(state.appWritten ?? false);
    if (!files.length) files = createBaseTemplate();

    if (pass === 0 && !state.retried) {
      state.big = classifyBig(job.prompt, job.is_first_build);
      await log(
        supabase,
        jobId,
        {
          kind: "thinking",
          text: state.big
            ? "Astra is reading the project and thinking through the full build"
            : "Astra is reading the project — quick change, building fast",
        },
        "thinking",
      );
    }

    const maxTokens = state.big
      ? Number(process.env.ASTRA_MAX_OUTPUT_TOKENS) || 16_000
      : 8_000;
    const maxPasses = state.big ? 4 : 2;

    // ── GENERATE (one model call, heartbeat while it runs) ──────────────────
    const system = state.repairNote
      ? buildRepairPrompt(state.repairNote)
      : firstBuild
        ? buildNewProjectPrompt()
        : buildEditPrompt();
    const contextPack = buildContextPack(files, job.prompt, {});
    const history = (job.messages ?? []).slice(-12);

    const heartbeat = setInterval(() => {
      void supabase
        .from("build_jobs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", jobId);
    }, 20_000);

    let res;
    try {
      res = await completeAstraText(
        [
          { role: "system", content: system },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          {
            role: "user" as const,
            content: `${contextPack}\n\n---\n\n## Request\n${job.prompt}${
              state.repairNote ? `\n\n## Continue/repair\n${state.repairNote}` : ""
            }`,
          },
        ],
        { maxTokens, reasoningEffort: "high" },
      );
    } finally {
      clearInterval(heartbeat);
    }
    if (!res.ok) {
      await fail(`${res.status}: ${res.detail}`);
      return;
    }

    await supabase
      .from("build_jobs")
      .update({
        input_tokens: job.input_tokens + (res.usage?.inputTokens ?? 0),
        output_tokens: job.output_tokens + (res.usage?.outputTokens ?? 0),
      })
      .eq("id", jobId);

    const plan = parseFilePatchPlan(res.text);

    // No parseable files → one format-forcing retry as its own chained pass.
    if (!plan) {
      if (!state.retried) {
        state.retried = true;
        state.repairNote = FORMAT_NOTE;
        state.lockUntil = 0;
        await saveState(supabase, jobId, state);
        await log(supabase, jobId, {
          kind: "writing",
          text: "First response had no files — asking Astra to emit the app directly",
        });
        await chainNext(supabase, jobId, origin);
        return;
      }
      await fail("Astra couldn't produce a valid file patch for this request.");
      return;
    }

    // ── VERIFY ───────────────────────────────────────────────────────────────
    if (plan.changes.some((c) => c.path === "src/App.tsx")) state.appWritten = true;
    const changed = new Set<string>([...(job.changed_paths ?? [])]);
    for (const c of plan.changes) changed.add(c.path);
    for (const e of plan.edits ?? []) changed.add(e.path);

    await log(
      supabase,
      jobId,
      {
        kind: "writing",
        text: `Astra wrote ${plan.changes.length} file${plan.changes.length === 1 ? "" : "s"}: ${plan.changes
          .map((c) => c.path.split("/").pop())
          .slice(0, 6)
          .join(", ")}${plan.changes.length > 6 ? "…" : ""}`,
      },
      "writing",
    );
    await log(
      supabase,
      jobId,
      { kind: "verifying", text: "Astra is reading the code again — checking imports and completeness" },
      "verifying",
    );

    const dropped = plan.changes
      .filter((c) => isCodePath(c.path) && !isCodeFileComplete(c.content))
      .map((c) => c.path);
    const cleanPlan = dropped.length
      ? { ...plan, changes: plan.changes.filter((c) => !dropped.includes(c.path)) }
      : plan;

    files = applyPatchPlan(files, cleanPlan);

    // Persist progress after EVERY pass (stubbed so the app always runs).
    const { files: safeFiles, stubbed } = stubDanglingImports(files);
    await saveProjectFiles(supabase, job.user_id, job.project_id, safeFiles);
    await supabase
      .from("build_jobs")
      .update({ changed_paths: Array.from(changed) })
      .eq("id", jobId);

    const issues = detectFatalIssues(cleanPlan, files, firstBuild && pass === 0);
    const missingApp = job.is_first_build && !state.appWritten;
    const incomplete = issues.length > 0 || missingApp || dropped.length > 0;

    state.planSummary = cleanPlan.plan?.trim() || state.planSummary;
    state.stubbedCount = stubbed.length;

    // ── DECIDE: done, or chain the next pass ────────────────────────────────
    if (!incomplete || pass + 1 >= maxPasses) {
      const summary =
        (state.planSummary || "Build complete.") +
        (stubbed.length
          ? ` (${stubbed.length} referenced file(s) stubbed — say "continue the build" to finish them.)`
          : "");
      await log(supabase, jobId, { kind: "applying", text: "Applying files to the project" }, "applying");
      await log(supabase, jobId, { kind: "info", text: "Build complete" });
      await supabase
        .from("build_jobs")
        .update({
          status: "done",
          result_summary: summary,
          completed_at: new Date().toISOString(),
          state: { ...state, lockUntil: 0 },
        })
        .eq("id", jobId);
      return;
    }

    state.pass = pass + 1;
    state.retried = false;
    state.repairNote = missingApp
      ? "The app is only partially built. Create every file still missing — START with src/App.tsx wiring HashRouter routes for all pages, then each missing page/component. Output ONLY missing or broken files."
      : `${describeFatalIssues(issues)}${
          dropped.length
            ? `\nThese files were cut off mid-stream and must be re-emitted complete: ${dropped.join(", ")}`
            : ""
        }`;
    state.lockUntil = 0;
    await saveState(supabase, jobId, state);
    await log(
      supabase,
      jobId,
      {
        kind: "repairing",
        text: missingApp
          ? "Astra is continuing the build — wiring App.tsx and the remaining pages"
          : `Astra found ${issues.length + dropped.length} issue${
              issues.length + dropped.length === 1 ? "" : "s"
            } and is fixing them`,
      },
      "repairing",
    );
    await chainNext(supabase, jobId, origin);
  } catch (e) {
    await fail(e instanceof Error ? e.message : "Build failed unexpectedly.");
  }
}
