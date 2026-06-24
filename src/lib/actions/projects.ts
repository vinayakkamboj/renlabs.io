"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProjectKind } from "@/lib/data/workspace";

export interface ImportFromGitHubInput {
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  language?: string | null;
}

/**
 * Import an existing GitHub repo as a new Ren project.
 * 1. Upserts the repo into the `repositories` table.
 * 2. Creates a `project` with kind="repository" linked to it.
 * 3. Redirects to the workspace, where files are loaded on-demand from GitHub.
 */
export async function importFromGitHub(input: ImportFromGitHubInput): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Upsert the repository row (on conflict, refresh metadata).
  const { data: repo, error: repoError } = await supabase
    .from("repositories")
    .upsert(
      {
        user_id: user.id,
        full_name: input.fullName,
        default_branch: input.defaultBranch,
        is_private: input.isPrivate,
        language: input.language ?? null,
        index_state: "queued",
      },
      { onConflict: "user_id,full_name" },
    )
    .select("id")
    .single();

  if (repoError || !repo) {
    throw new Error(`Failed to add repository: ${repoError?.message}`);
  }

  const projectName = input.fullName.split("/")[1] ?? input.fullName;
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: projectName,
      kind: "repository",
      status: "draft",
      repository_id: repo.id,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    throw new Error(`Failed to create project: ${projectError?.message}`);
  }

  revalidatePath("/dashboard");
  redirect(`/workspace/${project.id}`);
}

/**
 * Link a project to a GitHub repository (used after a "new" project's first
 * push creates a fresh repo). Upserts the repositories row and sets the
 * project's repository_id so future pushes update the same repo.
 *
 * Note: we intentionally do NOT change the project's `kind`. A "new" project
 * keeps its kind so the workspace never tries to re-pull files from the repo and
 * overwrite the generated code — it just gains a push target.
 */
export async function linkProjectToRepo(
  projectId: string,
  input: { fullName: string; defaultBranch: string; isPrivate: boolean },
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  try {
    const { data: repo } = await supabase
      .from("repositories")
      .upsert(
        {
          user_id: user.id,
          full_name: input.fullName,
          default_branch: input.defaultBranch,
          is_private: input.isPrivate,
          index_state: "queued",
        },
        { onConflict: "user_id,full_name" },
      )
      .select("id")
      .single();

    if (!repo) return { ok: false };

    await supabase
      .from("projects")
      .update({ repository_id: repo.id })
      .eq("id", projectId)
      .eq("user_id", user.id);

    revalidatePath(`/workspace/${projectId}`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export interface CreateProjectInput {
  name: string;
  kind: ProjectKind;
  description?: string;
  prompt?: string;
  repositoryId?: string;
}

/**
 * Create a new project row in Supabase and redirect to the project detail page.
 * Throws (which Next.js will surface as an error) if auth or DB fails.
 */
export async function createProject(input: CreateProjectInput): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      kind: input.kind,
      status: "draft",
      description: input.description?.trim() || null,
      prompt: input.prompt?.trim() || null,
      repository_id: input.repositoryId || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  redirect(`/workspace/${data.id}`);
}

export async function updateProjectGoals(
  projectId: string,
  goals: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const cleaned = goals.map((g) => g.trim()).filter(Boolean);

  const { error } = await supabase
    .from("projects")
    .update({ goals: cleaned, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}

/**
 * Save a project's business brief — the shared context every agent in the
 * workspace reads so each one understands the business it's building for.
 */
export async function updateProjectBrief(
  projectId: string,
  brief: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("projects")
    .update({ brief: brief.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}

/**
 * Delete a project row. Does NOT redirect — callers decide where to go next, so
 * deleting from a dashboard card simply removes the card in place (the card
 * revalidates the list), while the project detail page redirects to the list
 * itself after the row is gone.
 */
export async function deleteProject(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // RLS double-check

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}
