"use server";

import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface CollaboratorRow {
  email: string;
  status: "pending" | "accepted" | "declined";
}

export interface IncomingInvitation {
  id: string;
  projectId: string;
  projectName: string;
  invitedByEmail: string;
  createdAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite someone to collaborate by email. The invitee MUST already have a Ren
 * Code account — we resolve their user id from the email and create a pending
 * request they'll see in their dashboard and explicitly accept or decline.
 */
export async function inviteCollaborator(
  projectId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Collaboration requires Supabase to be configured." };
  }

  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (trimmed === (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "You can't invite yourself." };
  }

  // Must own the project to invite to it.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) {
    return { ok: false, error: "Project not found." };
  }

  // The invitee has to be a registered Ren Code user.
  const { data: invitedUserId, error: lookupError } = await supabase.rpc(
    "find_user_id_by_email",
    { p_email: trimmed },
  );
  if (lookupError) {
    return { ok: false, error: "Couldn't look up that account. Try again." };
  }
  if (!invitedUserId) {
    return {
      ok: false,
      error:
        "No Ren Code account is registered to that email. Ask them to sign up first, then invite them.",
    };
  }

  const { error } = await supabase.from("project_collaborators").upsert(
    {
      project_id: projectId,
      invited_email: trimmed,
      invited_user_id: invitedUserId as string,
      invited_by: user.id,
      invited_by_email: user.email,
      project_name: project.name,
      status: "pending",
      responded_at: null,
    },
    { onConflict: "project_id,invited_email" },
  );
  if (error) {
    return { ok: false, error: "Couldn't send the invitation. Try again." };
  }
  return { ok: true };
}

/** Collaborators on a project the current user owns. */
export async function getCollaborators(
  projectId: string,
): Promise<CollaboratorRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("project_collaborators")
    .select("invited_email, status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((c) => ({
    email: c.invited_email as string,
    status: c.status as CollaboratorRow["status"],
  }));
}

/** Pending collaboration requests addressed to the current user. */
export async function getIncomingInvitations(): Promise<IncomingInvitation[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("project_collaborators")
    .select("id, project_id, project_name, invited_by_email, created_at")
    .eq("invited_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    projectId: r.project_id as string,
    projectName: (r.project_name as string) ?? "Untitled project",
    invitedByEmail: (r.invited_by_email as string) ?? "A Ren Code user",
    createdAt: r.created_at as string,
  }));
}

/** Accept or decline a collaboration request. */
export async function respondToInvitation(
  invitationId: string,
  accept: boolean,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("project_collaborators")
    .update({
      status: accept ? "accepted" : "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("invited_user_id", user.id);

  return { ok: !error };
}
