"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface AddRepositoryInput {
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  language?: string | null;
}

/**
 * Add (upsert) a repository to the user's workspace.
 * On conflict (same user_id + full_name), updates the metadata.
 */
export async function addRepository(input: AddRepositoryInput): Promise<void> {
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

  const { error } = await supabase.from("repositories").upsert(
    {
      user_id: user.id,
      full_name: input.fullName,
      default_branch: input.defaultBranch,
      is_private: input.isPrivate,
      language: input.language ?? null,
      index_state: "queued",
    },
    { onConflict: "user_id,full_name" },
  );

  if (error) {
    throw new Error(`Failed to add repository: ${error.message}`);
  }

  revalidatePath("/dashboard/repositories");
  revalidatePath("/dashboard");
}

/**
 * Remove a repository from the user's workspace.
 * Redirects to the repositories list after deletion.
 */
export async function removeRepository(id: string): Promise<void> {
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
    .from("repositories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // RLS double-check

  if (error) {
    throw new Error(`Failed to remove repository: ${error.message}`);
  }

  revalidatePath("/dashboard/repositories");
  revalidatePath("/dashboard");
  redirect("/dashboard/repositories");
}
