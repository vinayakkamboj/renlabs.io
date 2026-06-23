/**
 * Core types for the Ren Code builder — the AI app-building workspace.
 *
 * A workspace holds a set of ProjectFiles (the generated app), a chat history,
 * and the model tier the user picked. The builder agent reads the files, scores
 * them for relevance, and emits a patch plan that mutates the file set. Sandpack
 * renders the live result.
 */

export interface ProjectFile {
  id?: string;
  path: string;
  content: string;
  language?: string | null;
}

/** A single change in a patch plan — a full-file write. */
export interface FilePatch {
  path: string;
  content: string;
}

/**
 * A surgical edit to an EXISTING file — an exact find/replace, like Claude's
 * Edit tool. `find` must occur exactly once in the target file. Edits keep the
 * rest of the file untouched, so the model only spends tokens on what changes.
 */
export interface FileEdit {
  path: string;
  find: string;
  replace: string;
}

/** The structured plan the agent emits inside a <file_patches> block. */
export interface FilePatchPlan {
  plan: string;
  changes: FilePatch[];
  /** Surgical find/replace edits to existing files (token-efficient). */
  edits?: FileEdit[];
  deletes?: string[];
  renames?: { from: string; to: string }[];
}

export type ChatRole = "user" | "assistant";

export interface BuildMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Patch plan applied by this assistant turn, if any. */
  plan?: { summary: string; files: string[] } | null;
  /** Image data URLs attached to a user message, if any. */
  images?: string[];
  createdAt: string;
}

/** A fatal issue that blocks a candidate patch set from being applied. */
export interface FatalIssue {
  type:
    | "missing-app-tsx"
    | "truncated"
    | "missing-file"
    | "no-changes"
    | "invalid-path"
    | "edit-failed";
  detail: string;
}

export type ProjectKind = "new" | "repository";
