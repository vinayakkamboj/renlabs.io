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
import { streamAstraText, type ChatMsg, type TokenUsage } from "@/lib/ai/astra";
import { extractUsage } from "@/lib/ai/usage";
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
  normalizeProjectImports,
  isCodePath,
  isCodeFileComplete,
} from "./file-patches";
import {
  hardenGeneratedFiles,
  detectDesignIssues,
  describeDesignIssues,
} from "./design-lint";
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
  /** How many consecutive "produced no parseable files" attempts so far. GLM's
   *  reasoning time varies call to call — one bad attempt (especially on a
   *  maximally complex prompt) isn't proof the request is impossible, so this
   *  is a bounded counter, not a one-shot flag. */
  emptyAttempts?: number;
  lockUntil?: number;
  planSummary?: string;
  stubbedCount?: number;
  /** The one bounded design-QA repair pass has already run — never loop it. */
  designPassDone?: boolean;
}

// How many consecutive zero-content attempts we tolerate before giving up.
// Each is a full model call within its own pass — expensive in wall-clock,
// but the build's credit charge is fixed per job, not per pass, so this only
// costs time and our own inference spend, never the user extra credits.
const MAX_EMPTY_ATTEMPTS = 3;

interface Step {
  t: number;
  kind: "thinking" | "writing" | "verifying" | "repairing" | "applying" | "info" | "error";
  text: string;
}

const FORMAT_NOTE =
  "Output the application NOW as a single <file_patches> JSON block with the FULL contents of every file. No prose, no questions — only the block.";

// Auto-decomposition: when an attempt produces ZERO files, retrying the same
// giant ask verbatim just fails the same way — the model spends its whole
// time slice reasoning about everything at once. So each retry NARROWS the
// pass instead: first to a bounded foundation, then to an emergency-minimal
// scaffold. The chain's normal continuation machinery (missing App.tsx,
// dangling imports, time slices) then builds the rest of the request on top,
// pass by pass — the huge brief stays in context the whole way.
const SCOPE_FOUNDATION_NOTE =
  "This request is LARGE — do NOT attempt the whole product in this pass. Build ONLY the foundation, completely: (1) src/index.css with the full design-token system for this brand, (2) the src/data/*.ts files with typed content, (3) src/App.tsx wiring HashRouter routes to simple placeholder pages you also create in this pass. MAXIMUM 8 files. Later passes will replace the placeholders with the full pages. Keep planning minimal — begin the <file_patches> block immediately.";
const SCOPE_MINIMAL_NOTE =
  "Emergency minimal pass: output AT MOST 4 files, under 400 total lines — src/App.tsx (routes with small inline placeholder pages), src/index.css, and at most two data files. Nothing else. No prose. Start your response with <file_patches>.";

// A pass is bounded by TIME, not just tokens: the function is killed at ~300s
// regardless of token budgets, and on GLM the (hidden) reasoning tokens count
// against max_tokens — so a token cap small enough to always fit in time also
// starves complex prompts of content. Instead we stream and cut generation at
// this deadline, salvage every complete file (the parser handles truncation),
// and let the NEXT pass continue the build. Override for hosts with different
// function limits.
//
// GLM reasons in one block BEFORE emitting any visible content — for a
// maximally complex ask ("exact real Minecraft graphics and functionality")
// its reasoning phase alone can run past 200s, so the deadline fires with
// ZERO file content ever produced, not just truncated files. The budget is
// kept close to the platform limit (300s) to give reasoning the most runway
// possible; ~30s of margin covers auth, DB writes, and the heartbeat setup
// that happen around the model call in the same invocation.
const PASS_TIME_BUDGET_MS =
  Number(process.env.ASTRA_PASS_TIME_BUDGET_MS) || 265_000;

/**
 * Run one model call, cutting the stream at the pass deadline. Whatever
 * arrived by then is returned (timeSliced=true) — the truncation-tolerant
 * parser recovers all complete files and the chain finishes the rest in the
 * following pass. Usage is only known when the stream ends naturally.
 */
async function generateTimeBoxed(
  messages: ChatMsg[],
  maxTokens: number,
): Promise<
  | { ok: true; text: string; usage: TokenUsage | null; timeSliced: boolean }
  | { ok: false; status: number; detail: string }
> {
  const res = await streamAstraText(messages, { maxTokens, reasoningEffort: "high" });
  if (!res.ok) return res;

  const reader = res.stream.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + PASS_TIME_BUDGET_MS;
  let raw = "";
  let timeSliced = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) raw += decoder.decode(value, { stream: true });
      if (Date.now() > deadline) {
        timeSliced = true;
        await reader.cancel().catch(() => {});
        break;
      }
    }
  } catch {
    // Upstream hiccup mid-stream — keep what we have; salvage handles it.
    timeSliced = true;
  }
  raw += decoder.decode();
  const { text, usage } = extractUsage(raw);
  return { ok: true, text, usage, timeSliced };
}

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
    // Heal src-rooted bare imports in previously-saved files — projects
    // persisted before the normalizer existed self-repair on their next pass.
    files = normalizeProjectImports(files).files;
    const firstBuild = (job.is_first_build || files.length === 0) && !(state.appWritten ?? false);
    if (!files.length) files = createBaseTemplate();

    if (pass === 0 && !state.emptyAttempts) {
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

    // Generous token budget — GLM's hidden reasoning tokens count against
    // max_tokens, so a tight cap starves complex prompts of file content
    // ("couldn't produce a valid file patch"). Time safety comes from the
    // streaming deadline in generateTimeBoxed, not from squeezing tokens.
    const maxTokens = state.big
      ? Number(process.env.ASTRA_MAX_OUTPUT_TOKENS) || 16_000
      : 8_000;
    const maxPasses = state.big ? 5 : 2;

    // ── GENERATE (one model call, heartbeat while it runs) ──────────────────
    const system = firstBuild
      ? buildNewProjectPrompt()
      : state.repairNote
        ? buildRepairPrompt(state.repairNote)
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
      res = await generateTimeBoxed(
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
        maxTokens,
      );
    } finally {
      clearInterval(heartbeat);
    }
    if (!res.ok) {
      await fail(`${res.status}: ${res.detail}`);
      return;
    }
    const timeSliced = res.timeSliced;
    if (timeSliced) {
      await log(supabase, jobId, {
        kind: "info",
        text: "Pass reached its time slice — saving what's complete and continuing",
      });
    }

    await supabase
      .from("build_jobs")
      .update({
        input_tokens: job.input_tokens + (res.usage?.inputTokens ?? 0),
        output_tokens: job.output_tokens + (res.usage?.outputTokens ?? 0),
      })
      .eq("id", jobId);

    const plan = parseFilePatchPlan(res.text);

    // No parseable files → format-forcing retry, bounded by MAX_EMPTY_ATTEMPTS.
    // On a very complex prompt GLM can spend an entire pass's time budget
    // reasoning and emit nothing — that's not proof the request is impossible,
    // just that reasoning didn't finish in time this attempt, so we retry
    // several times (each its own chained pass) before giving up.
    if (!plan) {
      const attempts = (state.emptyAttempts ?? 0) + 1;
      if (attempts < MAX_EMPTY_ATTEMPTS) {
        state.emptyAttempts = attempts;
        // Narrow the ask each retry rather than repeating the identical one:
        // retry 1 → bounded foundation; retry 2 → emergency-minimal scaffold.
        state.repairNote =
          attempts === 1
            ? `${FORMAT_NOTE}\n\n${SCOPE_FOUNDATION_NOTE}`
            : `${FORMAT_NOTE}\n\n${SCOPE_MINIMAL_NOTE}`;
        state.lockUntil = 0;
        await saveState(supabase, jobId, state);
        await log(supabase, jobId, {
          kind: "writing",
          text:
            attempts === 1
              ? "The request is big — narrowing this pass to the app's foundation first"
              : "Still no files — trying a minimal scaffold this pass",
        });
        await chainNext(supabase, jobId, origin);
        return;
      }
      await fail(
        `Astra spent ${MAX_EMPTY_ATTEMPTS} attempts reasoning without producing any files — this request may be too complex for one pass. Try breaking it into smaller steps (e.g. "scaffold the app structure first").`,
      );
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

    const applied = normalizeProjectImports(applyPatchPlan(files, cleanPlan));
    // Deterministic hardening — e.g. BrowserRouter → HashRouter — fixes the
    // unambiguous design bugs without spending a model call on them.
    const hardened = hardenGeneratedFiles(applied.files);
    files = hardened.files;
    if (applied.fixed.length) {
      await log(supabase, jobId, {
        kind: "verifying",
        text: `Normalized bare imports to relative paths in ${applied.fixed.length} file${applied.fixed.length === 1 ? "" : "s"}`,
      });
    }
    if (hardened.fixed.length) {
      await log(supabase, jobId, {
        kind: "verifying",
        text: `Auto-fixed router usage (BrowserRouter → HashRouter) in ${hardened.fixed.join(", ")}`,
      });
    }

    // Persist progress after EVERY pass (stubbed so the app always runs).
    const { files: safeFiles, stubbed } = stubDanglingImports(files);
    await saveProjectFiles(supabase, job.user_id, job.project_id, safeFiles);
    await supabase
      .from("build_jobs")
      .update({ changed_paths: Array.from(changed) })
      .eq("id", jobId);

    const issues = detectFatalIssues(cleanPlan, files, firstBuild && pass === 0);
    const missingApp = job.is_first_build && !state.appWritten;
    // A time-sliced pass is by definition unfinished — even if everything it
    // DID emit is clean — so it always chains a continuation pass.
    const incomplete =
      issues.length > 0 || missingApp || dropped.length > 0 || timeSliced;

    state.planSummary = cleanPlan.plan?.trim() || state.planSummary;
    state.stubbedCount = stubbed.length;

    // ── DESIGN QA — one bounded pass, only once the build is structurally
    // sound. Catches the "compiles fine, looks broken" class: emoji in UI,
    // hardcoded hex colors, placeholder fonts, missing dark theme, raw
    // anchors. Never loops: designPassDone guarantees at most one repair.
    if (!incomplete && !state.designPassDone && pass + 1 < maxPasses) {
      const designIssues = detectDesignIssues(cleanPlan, firstBuild && pass === 0);
      if (designIssues.length > 0) {
        state.pass = pass + 1;
        state.emptyAttempts = 0;
        state.designPassDone = true;
        state.repairNote =
          `The app builds, but a design review found these violations of the design contract. ` +
          `Fix ALL of them, changing only the files named — do not touch anything else:\n` +
          describeDesignIssues(designIssues);
        state.lockUntil = 0;
        await saveState(supabase, jobId, state);
        await log(
          supabase,
          jobId,
          {
            kind: "repairing",
            text: `Design review found ${designIssues.length} issue${designIssues.length === 1 ? "" : "s"} — Astra is polishing the design`,
          },
          "repairing",
        );
        await chainNext(supabase, jobId, origin);
        return;
      }
      state.designPassDone = true; // reviewed clean — don't re-lint later passes
    }

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
    state.emptyAttempts = 0; // this pass produced a real plan — reset the counter
    const issueNote = `${describeFatalIssues(issues)}${
      dropped.length
        ? `\nThese files were cut off mid-stream and must be re-emitted complete: ${dropped.join(", ")}`
        : ""
    }`.trim();
    state.repairNote = missingApp
      ? "The app is only partially built. Create every file still missing — START with src/App.tsx wiring HashRouter routes for all pages, then each missing page/component. Output ONLY missing or broken files."
      : issueNote ||
        // Time-sliced with everything emitted so far clean: plain continuation.
        "Your previous response was cut off by a time limit after the files already saved. Continue the build: output ONLY the remaining files still missing (pages, components, stores, data) as a <file_patches> block. Keep all existing files intact.";
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
