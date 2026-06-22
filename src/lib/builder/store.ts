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
  sendMessage: (text: string) => Promise<void>;
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

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isBuilding) return;

    const userMsg: BuildMessage = {
      id: newId(),
      role: "user",
      content: trimmed,
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
        }),
      });

      if (res.status === 503) throw new Error("builder_not_configured");
      if (!res.ok || !res.body) throw new Error("build_failed");

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

      // One repair attempt if the candidate is fatally broken.
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
            if (!retryIssues.length) plan = retryPlan;
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
      const nextFiles = applyPatchPlan(get().projectFiles, plan);
      const changedPaths = plan.changes.map((c) => c.path);

      const assistantMsg: BuildMessage = {
        id: newId(),
        role: "assistant",
        content: prose || plan.plan,
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
      const reason =
        e instanceof Error && e.message === "builder_not_configured"
          ? "The build agent isn't configured. Set OPENROUTER_API_KEY on the server."
          : "The build failed. Check your connection and try again.";
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
