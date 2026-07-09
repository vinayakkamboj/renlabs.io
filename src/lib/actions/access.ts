"use server";

/**
 * Trial access requests — the user half (request + own status) and the admin
 * half (list, approve, deny). An approved request IS the access grant: the
 * middleware and all compute APIs read access_requests.status directly.
 */

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient, isAdminDbConfigured } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/auth/admin";

export type AccessRequestStatus = "pending" | "approved" | "denied";

export interface AccessRequest {
  id: string;
  userId: string;
  email: string;
  note: string | null;
  status: AccessRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRequest(r: any): AccessRequest {
  return {
    id: r.id,
    userId: r.user_id,
    email: r.email,
    note: r.note ?? null,
    status: r.status,
    createdAt: r.created_at,
    decidedAt: r.decided_at ?? null,
    decidedBy: r.decided_by ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── User side ────────────────────────────────────────────────────────────────

/** The signed-in user's own trial request, if they've made one. */
export async function getMyAccessRequest(): Promise<AccessRequest | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("access_requests")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? mapRequest(data) : null;
}

/**
 * Submit (or refresh) a trial request for the signed-in user. Idempotent:
 * a pending request just updates its note; approved/denied stay decided.
 */
export async function requestAccess(
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Not configured." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Sign in first." };

  const { data: existing } = await supabase
    .from("access_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.status === "pending" && note?.trim()) {
      await supabase
        .from("access_requests")
        .update({ note: note.trim().slice(0, 500) })
        .eq("id", existing.id);
    }
    revalidatePath("/restricted");
    return { ok: true };
  }

  const { error } = await supabase.from("access_requests").insert({
    user_id: user.id,
    email: user.email,
    note: note?.trim().slice(0, 500) || null,
  });
  if (error) {
    const missing = error.message?.includes("does not exist");
    return {
      ok: false,
      error: missing
        ? "Requests aren't open yet — email hello@renlabs.io instead."
        : error.message,
    };
  }

  revalidatePath("/restricted");
  return { ok: true };
}

// ─── Admin side ───────────────────────────────────────────────────────────────

export async function listAccessRequests(): Promise<AccessRequest[]> {
  const admin = await getAdminUser();
  if (!admin || !isAdminDbConfigured()) return [];
  const db = createAdminClient();
  const { data } = await db
    .from("access_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map(mapRequest);
}

/** Approve or deny a trial request. Approval takes effect immediately —
 *  the user's very next request passes the gate. */
export async function decideAccessRequest(
  requestId: string,
  approve: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await getAdminUser();
  if (!admin) return { ok: false, error: "Not authorized." };
  if (!isAdminDbConfigured())
    return { ok: false, error: "Service role key not configured." };

  const db = createAdminClient();
  const { error } = await db
    .from("access_requests")
    .update({
      status: approve ? "approved" : "denied",
      decided_at: new Date().toISOString(),
      decided_by: admin.email,
    })
    .eq("id", requestId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/access");
  return { ok: true };
}
