"use server";

/**
 * Public preview links — mint an unguessable URL for a project that renders
 * the built app to anyone who opens it, no account required. Every call mints
 * a FRESH unique token (so each share is its own link), and ownership is
 * verified server-side before anything is created.
 */

import { randomBytes } from "crypto";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface CreatePreviewLinkResult {
  ok: boolean;
  /** URL path of the new public preview, e.g. "/p/f3a9…". */
  path?: string;
  error?: string;
}

export async function createPreviewLink(
  projectId: string,
): Promise<CreatePreviewLinkResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Preview links need the database configured." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Only the project's owner can mint links for it.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };

  // 16 random bytes → 22-char URL-safe token. Unguessable, unique per share.
  const token = randomBytes(16).toString("base64url");

  const { error } = await supabase.from("preview_links").insert({
    token,
    project_id: projectId,
    user_id: user.id,
  });
  if (error) {
    // Table missing (migration not applied) reads better than a raw PG error.
    return {
      ok: false,
      error: error.message.includes("does not exist")
        ? "Preview links aren't set up yet — apply migration 20260710_preview_links.sql."
        : error.message,
    };
  }

  return { ok: true, path: `/p/${token}` };
}
