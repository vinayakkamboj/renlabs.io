"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProjectKind } from "@/lib/data/workspace";

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
  redirect(`/dashboard/projects/${data.id}`);
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
