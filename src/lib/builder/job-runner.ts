/**
 * Server-side build job runner — the agentic loop that survives the browser.
 *
 * Runs Anthropic's evaluator-optimizer pattern server-side: GENERATE a patch,
 * VERIFY it (fatal-issue detection + app-wiring checks), then REPAIR/CONTINUE
 * in bounded passes until the app is whole. Every step appends to the job's
 * live activity feed, and the finished files are persisted to project_files —
 * so the user can close the tab, come back, and find the build done.
 *
 * NEVER import this from a client component.
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

const MAX_OUTPUT_TOKENS = Number(process.env.ASTRA_MAX_OUTPUT_TOKENS) || 16_000;
const MAX_PASSES = 4;

type Supa = ReturnType<typeof createAdminClient>;

interface JobRow {
  id: string;
  user_id: string;
  project_id: string;
  prompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  is_first_build: boolean;
}

interface Step {
  t: number;
  kind: "thinking" | "writing" | "verifying" | "repairing" | "applying" | "info" | "error";
  text: string;
}

/** Append a step to the live feed and (optionally) move the job status. */
async function log(
  supabase: Supa,
  jobId: string,
  steps: Step[],
  step: Omit<Step, "t">,
  status?: string,
) {
  steps.push({ t: Date.now(), ...step });
  await supabase
    .from("build_jobs")
    .update({
      steps,
      updated_at: new Date().toISOString(),
      ...(status ? { status } : {}),
    })
    .eq("id", jobId);
}

/** True if the job was cancelled from the client between passes. */
async function isCancelled(supabase: Supa, jobId: string): Promise<boolean> {
  const { data } = await supabase
    .from("build_jobs")
    .select("cancelled")
    .eq("id", jobId)
    .single();
  return Boolean(data?.cancelled);
}

async function loadProjectFiles(
  supabase: Supa,
  projectId: string,
): Promise<ProjectFile[]> {
  const { data } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId)
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
    updated_at: new Date().toISOString(),
  }));
  await supabase
    .from("project_files")
    .upsert(rows, { onConflict: "project_id,path" });
}

/** Execute one queued build job end-to-end. Errors land on the job row. */
export async function runBuildJob(jobId: string): Promise<void> {
  const supabase = createAdminClient();
  const steps: Step[] = [];

  const { data: jobData, error: jobError } = await supabase
    .from("build_jobs")
    .select("id, user_id, project_id, prompt, messages, is_first_build")
    .eq("id", jobId)
    .single();

  if (jobError || !jobData) return;
  const job = jobData as JobRow;

  const fail = async (message: string) => {
    await log(supabase, jobId, steps, { kind: "error", text: message });
    await supabase
      .from("build_jobs")
      .update({
        status: "error",
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  };

  try {
    // ── Context ──────────────────────────────────────────────────────────────
    let files = await loadProjectFiles(supabase, job.project_id);
    const firstBuild = job.is_first_build || files.length === 0;
    if (!files.length) files = createBaseTemplate();

    await log(
      supabase,
      jobId,
      steps,
      { kind: "thinking", text: "Astra is reading the project and thinking through the build" },
      "thinking",
    );

    const usage = { input: 0, output: 0 };
    const allChanged = new Set<string>();

    const generate = async (repairNote?: string) => {
      const system = repairNote
        ? buildRepairPrompt(repairNote)
        : firstBuild && !allChanged.size
          ? buildNewProjectPrompt()
          : buildEditPrompt();

      const contextPack = buildContextPack(files, job.prompt, {});
      const history = (job.messages ?? []).slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Heartbeat while the model generates (can run for minutes) so the client
      // can distinguish "still working" from a dead worker.
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
            ...history,
            {
              role: "user" as const,
              content: `${contextPack}\n\n---\n\n## Request\n${job.prompt}${
                repairNote ? `\n\n## Continue/repair\n${repairNote}` : ""
              }`,
            },
          ],
          { maxTokens: MAX_OUTPUT_TOKENS, reasoningEffort: "high" },
        );
      } finally {
        clearInterval(heartbeat);
      }
      if (!res.ok) throw new Error(`${res.status}: ${res.detail}`);
      usage.input += res.usage?.inputTokens ?? 0;
      usage.output += res.usage?.outputTokens ?? 0;
      return res.text;
    };

    // ── Agentic loop: generate → verify → repair/continue ───────────────────
    let plan = parseFilePatchPlan(await generate());

    // Retry net: prose/empty first response gets ONE format-forcing retry.
    if (!plan) {
      await log(supabase, jobId, steps, {
        kind: "writing",
        text: "First response had no files — asking Astra to emit the app directly",
      });
      plan = parseFilePatchPlan(
        await generate(
          "Output the application NOW as a single <file_patches> JSON block with the FULL contents of every file. No prose.",
        ),
      );
    }
    if (!plan) {
      await fail("Astra couldn't produce a valid file patch for this request.");
      return;
    }

    let appWritten =
      !firstBuild || plan.changes.some((c) => c.path === "src/App.tsx");

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      if (await isCancelled(supabase, jobId)) {
        await log(supabase, jobId, steps, { kind: "info", text: "Cancelled by user" });
        await supabase
          .from("build_jobs")
          .update({ status: "cancelled", completed_at: new Date().toISOString() })
          .eq("id", jobId);
        return;
      }

      if (plan.changes.some((c) => c.path === "src/App.tsx")) appWritten = true;
      for (const c of plan.changes) allChanged.add(c.path);
      for (const e of plan.edits ?? []) allChanged.add(e.path);

      await log(supabase, jobId, steps, {
        kind: "writing",
        text: `Astra wrote ${plan.changes.length} file${plan.changes.length === 1 ? "" : "s"}: ${plan.changes
          .map((c) => c.path.split("/").pop())
          .slice(0, 6)
          .join(", ")}${plan.changes.length > 6 ? "…" : ""}`,
      }, "writing");

      // VERIFY — drop truly incomplete files, detect dangling work.
      await log(supabase, jobId, steps, {
        kind: "verifying",
        text: "Astra is reading the code again — checking imports, routes, and completeness",
      }, "verifying");

      const dropped = plan.changes
        .filter((c) => isCodePath(c.path) && !isCodeFileComplete(c.content))
        .map((c) => c.path);
      if (dropped.length) {
        plan = {
          ...plan,
          changes: plan.changes.filter((c) => !dropped.includes(c.path)),
        };
      }

      files = applyPatchPlan(files, plan);

      // Persist progress after EVERY pass (stubbed so the app always runs) —
      // a refresh mid-build shows the files generated so far, and a dead
      // worker never loses completed work.
      await saveProjectFiles(
        supabase,
        job.user_id,
        job.project_id,
        stubDanglingImports(files).files,
      );

      const issues = detectFatalIssues(plan, files, firstBuild && pass === 0);
      const missingApp = firstBuild && !appWritten;

      if (!issues.length && !missingApp && !dropped.length) break; // verified whole

      if (pass === MAX_PASSES - 1) break; // out of passes — ship what we have, stubbed

      const note = missingApp
        ? "The app is only partially built. Create every file still missing — START with src/App.tsx wiring HashRouter routes for all pages, then each missing page/component. Output ONLY missing or broken files."
        : `${describeFatalIssues(issues)}${dropped.length ? `\nThese files were cut off mid-stream and must be re-emitted complete: ${dropped.join(", ")}` : ""}`;

      await log(supabase, jobId, steps, {
        kind: "repairing",
        text: missingApp
          ? "Astra is continuing the build — wiring App.tsx and the remaining pages"
          : `Astra found ${issues.length + dropped.length} issue${issues.length + dropped.length === 1 ? "" : "s"} and is repairing them`,
      }, "repairing");

      const next = parseFilePatchPlan(await generate(note));
      if (!next) break;
      plan = next;
    }

    // ── Apply: final integrity pass + persist ────────────────────────────────
    await log(supabase, jobId, steps, {
      kind: "applying",
      text: "Applying files to the project",
    }, "applying");

    const { files: finalFiles, stubbed } = stubDanglingImports(files);
    await saveProjectFiles(supabase, job.user_id, job.project_id, finalFiles);

    const summary =
      (plan?.plan?.trim() || "Build complete.") +
      (stubbed.length
        ? ` (${stubbed.length} referenced file(s) stubbed — say "continue the build" to finish them.)`
        : "");

    await log(supabase, jobId, steps, { kind: "info", text: "Build complete" });
    await supabase
      .from("build_jobs")
      .update({
        status: "done",
        result_summary: summary,
        changed_paths: Array.from(allChanged),
        input_tokens: usage.input,
        output_tokens: usage.output,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (e) {
    await fail(e instanceof Error ? e.message : "Build failed unexpectedly.");
  }
}
