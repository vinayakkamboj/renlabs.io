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
} from "./file-patches";
import { createBaseTemplate } from "./base-template";
import { DEFAULT_MODEL_TIER, type ModelTierId } from "./model-tiers";
import type { ProjectFile, BuildMessage } from "./types";

type BuildPhase = "idle" | "thinking" | "writing" | "applying" | "error";

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
  refreshViewer: () => void;
  sendMessage: (text: string, images?: string[]) => Promise<void>;
}

const LS_PREFIX = "ren-workspace:";

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
    return "The build agent isn't configured. Set OPENROUTER_API_KEY (or ANTHROPIC_API_KEY) on the server, then try again.";
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
          ? "The configured Astra model wasn't found — check OPENROUTER_MODEL / ANTHROPIC_MODEL."
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

  updateFileContent: (path, content) => {
    const files = get().projectFiles.map((f) =>
      f.path === path ? { ...f, content } : f,
    );
    set({ projectFiles: files });
    persist(get().projectId, files, get().messages);
  },

  refreshViewer: () => set((s) => ({ viewerKey: s.viewerKey + 1 })),

  sendMessage: async (text, images) => {
    const trimmed = text.trim();
    if ((!trimmed && !images?.length) || get().isBuilding) return;

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

    const runBuild = async (repairIssues?: string): Promise<string> => {
      const { messages, projectFiles, modelTier, isFirstBuild, recentlyChanged, projectKind } =
        get();
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      set({ phase: "writing" });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        set({ streamingText: stripFilePatchPlan(full) || "Working…" });
      }
      return full;
    };

    try {
      let full = await runBuild();
      let plan = parseFilePatchPlan(full);

      // One repair attempt if the candidate is fatally broken (e.g. a file was
      // truncated mid-stream, or an import dangles). Keep whichever attempt is
      // cleaner — the repair wins if it has strictly fewer fatal issues.
      if (plan) {
        const issues = detectFatalIssues(plan, get().projectFiles, get().isFirstBuild);
        if (issues.length) {
          set({ phase: "thinking", streamingText: "Reviewing and repairing…" });
          full = await runBuild(describeFatalIssues(issues));
          const retryPlan = parseFilePatchPlan(full);
          if (retryPlan) {
            const retryIssues = detectFatalIssues(
              retryPlan,
              get().projectFiles,
              get().isFirstBuild,
            );
            if (retryIssues.length < issues.length) plan = retryPlan;
          }
        }
      }

      const prose = stripFilePatchPlan(full);

      if (!plan) {
        // No applicable patch — treat as a plain assistant reply.
        const assistantMsg: BuildMessage = {
          id: newId(),
          role: "assistant",
          content: prose || "I couldn't produce a valid change. Try rephrasing.",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          messages: [...s.messages, assistantMsg],
          isBuilding: false,
          phase: "idle",
          streamingText: "",
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

      if (!plan.changes.length) {
        // The whole response was unusable (everything truncated).
        throw new Error("truncated_empty");
      }

      const nextFiles = applyPatchPlan(get().projectFiles, plan);
      const changedPaths = plan.changes.map((c) => c.path);

      const note = droppedFiles.length
        ? `\n\n_Note: ${droppedFiles.length} file(s) came back incomplete and were skipped to keep the preview working — ask me to finish ${droppedFiles.join(", ")}._`
        : "";

      const assistantMsg: BuildMessage = {
        id: newId(),
        role: "assistant",
        content: (prose || plan.plan) + note,
        plan: { summary: plan.plan, files: changedPaths },
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        projectFiles: nextFiles,
        messages: [...s.messages, assistantMsg],
        isBuilding: false,
        phase: "idle",
        streamingText: "",
        isFirstBuild: false,
        recentlyChanged: changedPaths,
        viewerKey: s.viewerKey + 1,
        activeFile: changedPaths.includes("src/App.tsx")
          ? "src/App.tsx"
          : (changedPaths[0] ?? s.activeFile),
      }));
      persist(get().projectId, nextFiles, get().messages);
    } catch (e) {
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
    }
  },
}));
