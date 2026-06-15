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

/**
 * Delete a project row and redirect back to the projects list.
 */
export async function deleteProject(id: string): Promise<void> {
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

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // RLS double-check

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  redirect("/dashboard/projects");
}
