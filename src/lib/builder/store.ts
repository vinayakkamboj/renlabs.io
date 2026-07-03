"use client";

/**
 * Workspace store — client-side state for a single project's build session.
 *
 * Holds the project files, chat history, the selected model tier, and the live
 * build status. `sendMessage` runs the full build loop: stream the agent, parse
 * the <file_patches> block, validate it, retry once on fatal issues, then apply
 * the patch atomically and refresh the preview. Files and messages persist to
 * localStorage per project and sync best-effort to the server.
 */

import { create } from "zustand";
import {
  parseFilePatchPlan,
  stripFilePatchPlan,
  applyPatchPlan,
  detectFatalIssues,
  describeFatalIssues,
  isCodePath,
  isCodeFileComplete,
  stubDanglingImports,
} from "./file-patches";
import { createBaseTemplate } from "./base-template";
import { DEFAULT_MODEL_TIER, type ModelTierId } from "./model-tiers";
import {
  extractUsage,
  PLAN_BEGIN_MARKER,
  PLAN_DONE_MARKER,
} from "@/lib/ai/usage";
import type { ProjectFile, BuildMessage, TurnUsage } from "./types";

type BuildPhase = "idle" | "thinking" | "writing" | "applying" | "error";

/** One line of the live build activity feed (background job mode). */
export interface BuildStep {
  t: number;
  kind: "thinking" | "writing" | "verifying" | "repairing" | "applying" | "info" | "error";
  text: string;
}

interface WorkspaceState {
  projectId: string;
  projectKind: "new" | "repository";
  projectFiles: ProjectFile[];
  messages: BuildMessage[];
  activeFile: string | null;
  modelTier: ModelTierId;
  viewerKey: number;
  isBuilding: boolean;
  phase: BuildPhase;
  streamingText: string;
  isFirstBuild: boolean;
  recentlyChanged: string[];
  error: string | null;
  /** Live credit balance reported by the last build (null until known). */
  creditsBalance: number | null;
  /** Usage of the most recent assistant turn, for the header readout. */
  lastUsage: TurnUsage | null;
  /** Background job activity feed (empty in legacy streaming mode). */
  buildSteps: BuildStep[];
  /** Id of the in-flight background job, if any. */
  activeJobId: string | null;

  initialize: (
    projectId: string,
    files: ProjectFile[],
    messages: BuildMessage[],
    isFirstBuild: boolean,
    projectKind?: "new" | "repository",
  ) => void;
  setActiveFile: (path: string) => void;
  setModelTier: (tier: ModelTierId) => void;
  updateFileContent: (path: string, content: string) => void;
  /** Replace the whole file set (e.g. after autonomous agents edit the project
   *  server-side) and refresh the preview so changes show immediately. */
  replaceFiles: (files: ProjectFile[]) => void;
  refreshViewer: () => void;
  /** Update the live credit balance (e.g. after an autonomous agent run). */
  setCreditsBalance: (balance: number) => void;
  sendMessage: (text: string, images?: string[]) => Promise<void>;
  /** Abort an in-flight build. Stops the stream and leaves files untouched. */
  stopBuild: () => void;
  /** Resume watching a background job after a reload/return to the workspace. */
  resumeActiveJob: () => Promise<void>;
}

const LS_PREFIX = "ren-workspace:";

/**
 * The AbortController for the in-flight build, kept at module scope (not in
 * React/zustand state) so the fetch can be cancelled without triggering a
 * re-render. `stopBuild` aborts it; `sendMessage` creates a fresh one per run.
 */
let buildAbortController: AbortController | null = null;

/** True when a thrown/caught error is the result of a user-initiated abort. */
function isAbortError(e: unknown): boolean {
  return (
    e instanceof DOMException && e.name === "AbortError"
  ) || (e instanceof Error && e.name === "AbortError");
}

function persist(projectId: string, files: ProjectFile[], messages: BuildMessage[]) {
  try {
    localStorage.setItem(
      LS_PREFIX + projectId,
      JSON.stringify({ files, messages }),
    );
  } catch {
    /* quota or unavailable — non-fatal */
  }
  // Best-effort server sync; ignore failures (table may not exist yet).
  fetch("/api/builder/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, files }),
  }).catch(() => {});
}

export function loadPersisted(
  projectId: string,
): { files: ProjectFile[]; messages: BuildMessage[] } | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + projectId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      files: ProjectFile[];
      messages: BuildMessage[];
    };
    if (!Array.isArray(parsed.files)) return null;
    return { files: parsed.files, messages: parsed.messages ?? [] };
  } catch {
    return null;
  }
}

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Turn a thrown build error into a clear, actionable chat message. We carry the
 * upstream HTTP status (and any provider detail) through as `upstream:<status>:<detail>`
 * so the user sees *why* a build failed — a bad key, a wrong model, or a rate
 * limit — instead of a generic "check your connection".
 */
function describeBuildError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";

  if (msg === "builder_not_configured") {
    return "The build agent isn't configured. Set FIREWORKS_API_KEY (or ANTHROPIC_API_KEY) on the server, then try again.";
  }
  if (msg === "insufficient_credits") {
    return "You're out of build credits. Top up in Billing to keep building.";
  }
  if (msg === "auth_required") {
    return "Your session expired. Sign in again to keep building.";
  }
  if (msg === "truncated_empty") {
    return "Astra's response was cut off before any complete file came through. Try again, or break the request into smaller steps.";
  }
  if (msg.startsWith("upstream:")) {
    const [, statusStr, ...rest] = msg.split(":");
    const status = Number(statusStr);
    const detail = rest.join(":").trim();
    const hint =
      status === 401 || status === 403
        ? "The Astra API key was rejected — check the key on the server."
        : status === 404
          ? "The configured Astra model wasn't found — check FIREWORKS_MODEL / ANTHROPIC_MODEL."
          : status === 429
            ? "Astra is rate-limited right now. Wait a moment and try again."
            : status >= 500
              ? "Astra's provider had a temporary error. Try again in a moment."
              : "The build couldn't be completed.";
    return detail ? `${hint} (${status}: ${detail})` : `${hint} (error ${status})`;
  }
  return "The build failed — couldn't reach the build agent. Check your connection and try again.";
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projectId: "",
  projectKind: "new",
  projectFiles: [],
  messages: [],
  activeFile: null,
  modelTier: DEFAULT_MODEL_TIER,
  viewerKey: 0,
  isBuilding: false,
  phase: "idle",
  streamingText: "",
  isFirstBuild: true,
  recentlyChanged: [],
  error: null,
  creditsBalance: null,
  lastUsage: null,
  buildSteps: [],
  activeJobId: null,

  initialize: (projectId, files, messages, isFirstBuild, projectKind = "new") => {
    const seeded = files.length ? files : createBaseTemplate();
    set({
      projectId,
      projectKind,
      projectFiles: seeded,
      messages,
      isFirstBuild,
      activeFile:
        seeded.find((f) => f.path === "src/App.tsx")?.path ??
        seeded[0]?.path ??
        null,
      viewerKey: 0,
      phase: "idle",
      error: null,
    });
  },

  setActiveFile: (path) => set({ activeFile: path }),
  setModelTier: (tier) => set({ modelTier: tier }),
  setCreditsBalance: (balance) => set({ creditsBalance: balance }),

  updateFileContent: (path, content) => {
    const files = get().projectFiles.map((f) =>
      f.path === path ? { ...f, content } : f,
    );
    set({ projectFiles: files });
    persist(get().projectId, files, get().messages);
  },

  replaceFiles: (files) => {
    if (!files.length) return;
    set((s) => ({
      projectFiles: files,
      viewerKey: s.viewerKey + 1,
      activeFile:
        files.find((f) => f.path === "src/App.tsx")?.path ??
        files[0]?.path ??
        s.activeFile,
    }));
    persist(get().projectId, files, get().messages);
  },

  refreshViewer: () => set((s) => ({ viewerKey: s.viewerKey + 1 })),

  stopBuild: () => {
    if (!get().isBuilding) return;
    const jobId = get().activeJobId;
    if (jobId) {
      // Background job: request server-side cancellation; the watcher reports
      // the final state (the runner stops at the next pass boundary).
      void fetch(`/api/builder/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      }).catch(() => {});
      set({ streamingText: "Stopping…" });
      return;
    }
    buildAbortController?.abort();
    buildAbortController = null;
    set({
      isBuilding: false,
      phase: "idle",
      streamingText: "",
      error: null,
    });
  },

  resumeActiveJob: async () => {
    const projectId = get().projectId;
    if (!projectId || get().isBuilding) return;
    try {
      const res = await fetch(`/api/builder/jobs?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) return;
      const { job } = (await res.json()) as { job: JobStatus | null };
      if (!job) return;
      const ACTIVE = ["queued", "thinking", "writing", "verifying", "repairing", "applying"];
      if (ACTIVE.includes(job.status)) {
        // A build is still running server-side — reattach to it.
        set({
          isBuilding: true,
          activeJobId: job.id,
          buildSteps: (job.steps ?? []) as BuildStep[],
          phase: jobPhase(job.status),
          error: null,
        });
        watchJob(job.id, job.credits_deducted ?? 0);
      } else if (job.status === "done" && localStorage.getItem(SEEN_JOB_KEY + projectId) !== job.id) {
        // Finished while the user was away — pull in the results now.
        await finalizeJob(job, job.credits_deducted ?? 0);
      }
    } catch {
      /* resume is best-effort */
    }
  },

  sendMessage: async (text, images) => {
    const trimmed = text.trim();
    if ((!trimmed && !images?.length) || get().isBuilding) return;

    // Fresh abort controller for this run; stopBuild() aborts it.
    const controller = new AbortController();
    buildAbortController = controller;

    const userMsg: BuildMessage = {
      id: newId(),
      role: "user",
      content: trimmed,
      images: images?.length ? images : undefined,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      messages: [...s.messages, userMsg],
      isBuilding: true,
      phase: "thinking",
      streamingText: "",
      error: null,
    }));
    // Persist the prompt immediately so a refresh mid-build keeps the request
    // (and any files built so far) instead of resetting to a blank template.
    persist(get().projectId, get().projectFiles, get().messages);

    // ── Background job mode (preferred) ──────────────────────────────────────
    // The build runs server-side and survives closing the browser. Falls back
    // to the legacy in-browser stream when jobs are unavailable (no migration,
    // Supabase off) or the message carries images (vision needs the stream path).
    if (!images?.length) {
      try {
        const jobRes = await fetch("/api/builder/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: get().projectId,
            prompt: trimmed,
            messages: get().messages.map((m) => ({ role: m.role, content: m.content })),
            isFirstBuild: get().isFirstBuild,
          }),
        });
        if (jobRes.ok) {
          const d = (await jobRes.json()) as {
            jobId: string;
            creditsDeducted?: number;
            creditsBalance?: number | null;
          };
          if (typeof d.creditsBalance === "number") set({ creditsBalance: d.creditsBalance });
          set({ activeJobId: d.jobId, phase: "thinking", buildSteps: [] });
          watchJob(d.jobId, d.creditsDeducted ?? 0);
          return; // the job watcher owns completion from here
        }
        if (jobRes.status === 402) throw new Error("insufficient_credits");
        if (jobRes.status === 401) throw new Error("auth_required");
        // 503 jobs_unavailable (or anything else) → legacy streaming below.
      } catch (e) {
        if (e instanceof Error && (e.message === "insufficient_credits" || e.message === "auth_required")) {
          const reason = describeBuildError(e);
          set((s) => ({
            messages: [...s.messages, { id: newId(), role: "assistant" as const, content: reason, createdAt: new Date().toISOString() }],
            isBuilding: false,
            phase: "error" as const,
            error: reason,
          }));
          return;
        }
        // Network hiccup on job creation — fall through to the streaming path.
      }
    }

    // Usage accumulates across the initial run and any repair pass so the chat
    // shows the true cost of producing the final result.
    const usageAcc: TurnUsage = { inputTokens: 0, outputTokens: 0, creditsDeducted: 0 };

    const runBuild = async (repairIssues?: string): Promise<string> => {
      const { messages, projectFiles, modelTier, isFirstBuild, recentlyChanged, projectKind } =
        get();
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          projectFiles,
          modelTier,
          isFirstBuild,
          recentlyChanged,
          repairIssues,
          isRepository: projectKind === "repository",
          images: lastUser?.images ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        // Surface the real reason instead of a generic failure. The route
        // returns a small JSON body ({ error, detail }) on every error path.
        let info: { error?: string; detail?: string } = {};
        try {
          info = (await res.json()) as { error?: string; detail?: string };
        } catch {
          /* non-JSON body — fall through to status-only reason */
        }
        if (res.status === 503 || info.error === "builder_not_configured") {
          throw new Error("builder_not_configured");
        }
        if (res.status === 402 || info.error === "insufficient_credits") {
          throw new Error("insufficient_credits");
        }
        if (info.error === "auth_required") {
          throw new Error("auth_required");
        }
        const detail = (info.detail || info.error || "").toString().slice(0, 240);
        throw new Error(`upstream:${res.status}:${detail}`);
      }

      // Credit figures come back as headers (known before streaming starts).
      const balHeader = res.headers.get("x-ren-credits-balance");
      const dedHeader = res.headers.get("x-ren-credits-deducted");
      if (balHeader !== null) set({ creditsBalance: Number(balHeader) });
      if (dedHeader !== null) usageAcc.creditsDeducted! += Number(dedHeader);
      // Which provider actually served this build (fireworks = GLM primary,
      // anthropic = Claude fallback kicked in). Logged for diagnosis.
      const provider = res.headers.get("x-ren-provider");
      if (provider) console.info(`[ren] build served by: ${provider}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      // If the stream drops mid-build (a Vercel timeout, a flaky connection),
      // we DON'T discard what already arrived — we salvage every complete file
      // from the partial response. Only a user-initiated Stop (abort) aborts hard.
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          // The orchestrated stream has two parts: a live design plan (between
          // PLAN_BEGIN/PLAN_DONE) shown as "Plan" feedback, then the build. A plain
          // build (edit/repair/no design phase) has no markers and is all build.
          const doneIdx = full.indexOf(PLAN_DONE_MARKER);
          if (full.includes(PLAN_BEGIN_MARKER) && doneIdx < 0) {
            const planText = extractUsage(
              full.slice(full.indexOf(PLAN_BEGIN_MARKER) + PLAN_BEGIN_MARKER.length),
            ).text;
            set({ phase: "thinking", streamingText: planText.trim() || "Designing the app…" });
          } else {
            const buildText =
              doneIdx >= 0 ? full.slice(doneIdx + PLAN_DONE_MARKER.length) : full;
            set({
              phase: "writing",
              streamingText: extractUsage(stripFilePatchPlan(buildText)).text || "Working…",
            });
          }
        }
      } catch (streamErr) {
        // User pressed Stop — propagate so the build unwinds cleanly.
        if (isAbortError(streamErr)) throw streamErr;
        // Otherwise the connection dropped: keep `full` as-is and fall through to
        // parse whatever complete files we managed to receive.
      }
      // Parse file patches only from the build portion (never the design plan).
      const doneIdx = full.indexOf(PLAN_DONE_MARKER);
      const buildPortion =
        doneIdx >= 0
          ? full.slice(doneIdx + PLAN_DONE_MARKER.length)
          : full.includes(PLAN_BEGIN_MARKER)
            ? ""
            : full;
      // Pull the usage marker out before returning so the parser never sees it.
      const { text, usage } = extractUsage(buildPortion);
      if (usage) {
        usageAcc.inputTokens += usage.inputTokens;
        usageAcc.outputTokens += usage.outputTokens;
      }
      return text;
    };

    // True once a partial pass has been applied+persisted this turn — the
    // abort handler must not claim "files are unchanged" when they have.
    let partialApplied = false;

    try {
      let full = await runBuild();
      let plan = parseFilePatchPlan(full);

      // Safety net: if the first attempt returned no usable file block at all
      // (the model replied with prose, or came back empty because a slow phase
      // ate the budget), force ONE direct retry that demands the patch format
      // before we ever show "couldn't produce a valid change".
      if (!plan) {
        set({ phase: "writing", streamingText: "Generating files…" });
        full = await runBuild(
          "Output the application NOW as a single <file_patches> JSON block with the FULL contents of every file. Do not explain, do not ask questions, do not return prose — emit only the <file_patches> block.",
        );
        plan = parseFilePatchPlan(full);
      }
      // Finish-the-job pass. A first build that came back truncated (connection
      // dropped, or token limit) or with dangling imports is INCOMPLETE, not
      // broken. Rather than regenerate the whole app from scratch — which just
      // truncates again on a large site — we apply what we got and CONTINUE
      // building on top of it (edit mode), the way a real coding agent finishes
      // its work. A first build that never wrote src/App.tsx counts as incomplete
      // even when nothing dangles (it was cut off before wiring the app up).
      // Each build call is bounded (small token ceiling) so it never times out;
      // we run several to assemble a full app. Allow enough passes to finish a
      // multi-page site without a single call ever risking a 504.
      const MAX_FINISH_PASSES = 4;
      // Capture the first-build intent ONCE — it must not flip mid-loop, or the
      // "App.tsx still missing" check would wrongly read as satisfied after the
      // first partial pass and stop continuing. `appWritten` stays sticky across
      // passes: once App.tsx is actually written, the app is considered wired.
      const wasFirstBuild = get().isFirstBuild;
      let appWritten =
        !wasFirstBuild ||
        (plan?.changes.some((c) => c.path === "src/App.tsx") ?? false);
      for (let pass = 0; plan && pass < MAX_FINISH_PASSES; pass++) {
        if (plan.changes.some((c) => c.path === "src/App.tsx")) appWritten = true;
        const issues = detectFatalIssues(plan, get().projectFiles, wasFirstBuild);
        // Incomplete if imports dangle (missing files) OR a first build hasn't
        // written its App.tsx yet (it was cut off before wiring the app up).
        if (!issues.length && appWritten) break; // complete — apply happens below

        // Commit what we have so the next pass builds ON it (edit mode), and
        // persist it so a refresh keeps the partial app instead of losing it.
        // Stub any dangling imports so the persisted partial always RUNS —
        // a Stop or refresh mid-continuation must never leave App.tsx importing
        // pages that don't exist yet ("Could not find module" preview crash).
        const safePartial = stubDanglingImports(
          applyPatchPlan(get().projectFiles, plan),
        ).files;
        partialApplied = true;
        set({
          projectFiles: safePartial,
          isFirstBuild: false,
          phase: "thinking",
          streamingText: "Finishing the build…",
        });
        persist(get().projectId, get().projectFiles, get().messages);
        const note = !appWritten
          ? "The app is only partially built. Continue building it: create every file still missing — START with src/App.tsx wiring HashRouter routes for all pages, then each page and component referenced but not yet created. Keep all existing files intact; output ONLY the files still missing or broken, as a <file_patches> block."
          : describeFatalIssues(issues);
        const nextFull = await runBuild(note);
        const nextPlan = parseFilePatchPlan(nextFull);
        if (!nextPlan) break; // continuation produced nothing usable — keep what we applied
        full = nextFull;
        plan = nextPlan;
      }

      const prose = stripFilePatchPlan(full);
      // Only attach usage if we actually measured tokens this turn.
      const turnUsage: TurnUsage | null = usageAcc.outputTokens > 0 ? usageAcc : null;

      if (!plan) {
        // No applicable patch — treat as a plain assistant reply.
        const assistantMsg: BuildMessage = {
          id: newId(),
          role: "assistant",
          content: prose || "I couldn't produce a valid change. Try rephrasing.",
          usage: turnUsage,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          messages: [...s.messages, assistantMsg],
          isBuilding: false,
          phase: "idle",
          streamingText: "",
          lastUsage: turnUsage,
        }));
        persist(get().projectId, get().projectFiles, get().messages);
        return;
      }

      set({ phase: "applying" });

      // Final safety net: never write a code file that is syntactically
      // incomplete (cut off mid-stream). Dropping it keeps the previous good
      // version (for edits) or omits the file (for new ones) — either is far
      // safer than crashing the preview with an unterminated-string error.
      const droppedFiles = plan.changes
        .filter((c) => isCodePath(c.path) && !isCodeFileComplete(c.content))
        .map((c) => c.path);
      if (droppedFiles.length) {
        plan = {
          ...plan,
          changes: plan.changes.filter((c) => !droppedFiles.includes(c.path)),
        };
      }

      const editPaths = (plan.edits ?? []).map((e) => e.path);
      if (!plan.changes.length && !editPaths.length) {
        // The whole response was unusable (everything truncated).
        throw new Error("truncated_empty");
      }

      // Final integrity pass: stub any import that still doesn't resolve so the
      // preview always renders (a visible "still being built" page beats a
      // "Could not find module" crash).
      const { files: nextFiles, stubbed } = stubDanglingImports(
        applyPatchPlan(get().projectFiles, plan),
      );
      // Track both full-file writes and surgical edits as "changed".
      const changedPaths = Array.from(
        new Set([...plan.changes.map((c) => c.path), ...editPaths]),
      );

      const noteParts: string[] = [];
      if (droppedFiles.length) {
        noteParts.push(
          `${droppedFiles.length} file(s) came back incomplete and were skipped to keep the preview working — ask me to finish ${droppedFiles.join(", ")}.`,
        );
      }
      if (stubbed.length) {
        noteParts.push(
          `${stubbed.length} referenced file(s) weren't generated yet, so I stubbed them to keep the app running — say "continue the build" and I'll finish ${stubbed.join(", ")}.`,
        );
      }
      const note = noteParts.length ? `\n\n_Note: ${noteParts.join(" ")}_` : "";

      // Keep the chat concise: lead with the one-line plan summary (the file
      // list is shown as a chip below). Only fall back to prose if there's no
      // plan summary. Long model prose / reasoning never goes into the bubble.
      const headline = plan.plan?.trim() || prose || "Done.";
      const assistantMsg: BuildMessage = {
        id: newId(),
        role: "assistant",
        content: headline + note,
        plan: { summary: plan.plan, files: changedPaths },
        usage: turnUsage,
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        projectFiles: nextFiles,
        messages: [...s.messages, assistantMsg],
        isBuilding: false,
        phase: "idle",
        streamingText: "",
        lastUsage: turnUsage,
        isFirstBuild: false,
        recentlyChanged: changedPaths,
        viewerKey: s.viewerKey + 1,
        activeFile: changedPaths.includes("src/App.tsx")
          ? "src/App.tsx"
          : (changedPaths[0] ?? s.activeFile),
      }));
      buildAbortController = null;
      persist(get().projectId, nextFiles, get().messages);
    } catch (e) {
      // User pressed Stop — exit quietly, leave files as they were, no error
      // bubble and crucially no repair retry (the loop already unwound).
      if (isAbortError(e)) {
        const stoppedMsg: BuildMessage = {
          id: newId(),
          role: "assistant",
          content: partialApplied
            ? 'Stopped. I kept the files built so far and stubbed any missing pages so the preview still runs — say "continue the build" to finish the rest.'
            : "Stopped. Your files are unchanged — send a new instruction whenever you're ready.",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          messages: [...s.messages, stoppedMsg],
          isBuilding: false,
          phase: "idle",
          streamingText: "",
          error: null,
        }));
        buildAbortController = null;
        return;
      }
      const reason = describeBuildError(e);
      const assistantMsg: BuildMessage = {
        id: newId(),
        role: "assistant",
        content: reason,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, assistantMsg],
        isBuilding: false,
        phase: "error",
        streamingText: "",
        error: reason,
      }));
      buildAbortController = null;
    }
  },
}));

// ─── Background job watcher (module scope — uses the store's static API) ────

const SEEN_JOB_KEY = "ren-seen-job:";
const JOB_POLL_MS = 1600;

interface JobStatus {
  id: string;
  status: string;
  steps: BuildStep[] | null;
  result_summary: string | null;
  changed_paths: string[] | null;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  credits_deducted: number;
}

let jobPollTimer: ReturnType<typeof setTimeout> | null = null;

function jobPhase(status: string): BuildPhase {
  if (status === "writing") return "writing";
  if (status === "applying") return "applying";
  return "thinking"; // queued / thinking / verifying / repairing
}

function appendAssistant(content: string, extra?: Partial<BuildMessage>) {
  const s = useWorkspaceStore.getState();
  const msg: BuildMessage = {
    id: newId(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  useWorkspaceStore.setState({ messages: [...s.messages, msg] });
  persist(s.projectId, useWorkspaceStore.getState().projectFiles, useWorkspaceStore.getState().messages);
}

/** A finished job — pull the built files into the workspace and close out. */
async function finalizeJob(job: JobStatus, creditsDeducted: number) {
  const { projectId } = useWorkspaceStore.getState();
  try {
    const res = await fetch(`/api/builder/files?projectId=${encodeURIComponent(projectId)}`);
    const { files } = (await res.json()) as { files: ProjectFile[] };
    const changed = (job.changed_paths ?? []) as string[];
    const usage: TurnUsage | null =
      job.output_tokens > 0
        ? {
            inputTokens: job.input_tokens,
            outputTokens: job.output_tokens,
            creditsDeducted,
          }
        : null;

    if (files?.length) {
      useWorkspaceStore.setState((s) => ({
        projectFiles: files,
        viewerKey: s.viewerKey + 1,
        isFirstBuild: false,
        recentlyChanged: changed,
        activeFile: changed.includes("src/App.tsx")
          ? "src/App.tsx"
          : (changed[0] ?? s.activeFile),
        lastUsage: usage,
      }));
    }
    appendAssistant(job.result_summary || "Build complete.", {
      plan: { summary: job.result_summary || "Build complete.", files: changed },
      usage,
    });
  } catch {
    appendAssistant(job.result_summary || "Build complete — refresh to see the new files.");
  } finally {
    try {
      localStorage.setItem(SEEN_JOB_KEY + projectId, job.id);
    } catch { /* quota */ }
    useWorkspaceStore.setState({
      isBuilding: false,
      phase: "idle",
      streamingText: "",
      buildSteps: [],
      activeJobId: null,
    });
  }
}

/** Poll a background job until it reaches a terminal state. */
function watchJob(jobId: string, creditsDeducted: number) {
  if (jobPollTimer) clearTimeout(jobPollTimer);

  const poll = async () => {
    // The user may have navigated to another project — stop watching.
    if (useWorkspaceStore.getState().activeJobId !== jobId) return;
    try {
      const res = await fetch(`/api/builder/jobs/${jobId}`);
      if (res.ok) {
        const { job } = (await res.json()) as { job: JobStatus | null };
        if (job) {
          useWorkspaceStore.setState({
            buildSteps: (job.steps ?? []) as BuildStep[],
            phase: jobPhase(job.status),
          });
          if (job.status === "done") {
            await finalizeJob(job, creditsDeducted || job.credits_deducted || 0);
            return;
          }
          if (job.status === "error") {
            const reason = job.error ?? "The build failed on the server.";
            appendAssistant(reason);
            useWorkspaceStore.setState({
              isBuilding: false,
              phase: "error",
              error: reason,
              streamingText: "",
              buildSteps: [],
              activeJobId: null,
            });
            return;
          }
          if (job.status === "cancelled") {
            appendAssistant(
              "Stopped. Files already written were kept — say \"continue the build\" to finish the rest.",
            );
            useWorkspaceStore.setState({
              isBuilding: false,
              phase: "idle",
              streamingText: "",
              buildSteps: [],
              activeJobId: null,
            });
            return;
          }
        }
      }
    } catch {
      /* transient network error — keep polling; the job is running server-side */
    }
    jobPollTimer = setTimeout(poll, JOB_POLL_MS);
  };

  jobPollTimer = setTimeout(poll, 900);
}
