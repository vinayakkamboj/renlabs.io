"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupabaseIntegration {
  id: string;
  projectId: string;
  projectUrl: string;
  /**
   * The anon/public key. Safe to expose to the browser by design (it's the
   * key meant for client use, gated by the connected project's RLS).
   */
  anonKey: string;
  /** Whether a service-role key is stored — the key itself is NEVER returned. */
  hasServiceRoleKey: boolean;
  status: string;
  createdAt: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get the Supabase integration for a specific project. The service-role key is
 * intentionally never included in the returned object — only a boolean flag —
 * so it can never leak to a client component.
 */
export async function getSupabaseIntegration(
  projectId: string,
): Promise<SupabaseIntegration | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_integrations")
    .select("id, config, status, created_at")
    .eq("user_id", user.id)
    .eq("kind", "supabase")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!data) return null;
  const cfg = data.config as Record<string, string>;
  return {
    id: data.id,
    projectId,
    projectUrl: cfg.project_url ?? "",
    // anon key is decrypted server-side; safe to surface (public by design).
    anonKey: decryptSecret(cfg.anon_key ?? ""),
    hasServiceRoleKey: !!cfg.service_role_key,
    status: data.status,
    createdAt: data.created_at,
  };
}

/**
 * Server-only: resolve a project's Supabase credentials for backend use (schema
 * reads, agent context). Returns the DECRYPTED keys. NEVER return this to a
 * client component — keep it inside server actions / route handlers.
 */
export async function getSupabaseCredentials(projectId: string): Promise<{
  projectUrl: string;
  anonKey: string;
  serviceRoleKey: string;
} | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_integrations")
    .select("config")
    .eq("user_id", user.id)
    .eq("kind", "supabase")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!data) return null;
  const cfg = data.config as Record<string, string>;
  return {
    projectUrl: cfg.project_url ?? "",
    anonKey: decryptSecret(cfg.anon_key ?? ""),
    serviceRoleKey: decryptSecret(cfg.service_role_key ?? ""),
  };
}

export async function getSupabaseSchema(projectId: string): Promise<{
  ok: boolean;
  tables?: TableInfo[];
  error?: string;
}> {
  const creds = await getSupabaseCredentials(projectId);
  if (!creds) return { ok: false, error: "No Supabase integration connected." };
  return fetchSchemaFromUrl(creds.projectUrl, creds.serviceRoleKey || creds.anonKey);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function saveSupabaseIntegration(input: {
  projectId: string;
  projectUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Confirm the project belongs to this user before attaching anything to it.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };

  const url = input.projectUrl.trim().replace(/\/$/, "");
  const anonKey = input.anonKey.trim();
  const serviceKey = input.serviceRoleKey.trim();

  // Validate the connection before saving.
  const test = await pingSupabase(url, serviceKey || anonKey);
  if (!test.ok) return { ok: false, error: test.error };

  // Encrypt both keys at rest. The service-role key in particular bypasses RLS
  // on the user's own project, so it must never sit in plaintext.
  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: user.id,
      project_id: input.projectId,
      kind: "supabase",
      config: {
        project_url: url,
        anon_key: encryptSecret(anonKey),
        service_role_key: serviceKey ? encryptSecret(serviceKey) : "",
      },
      status: "connected",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind,project_id" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/projects/${input.projectId}`);
  return { ok: true };
}

export async function deleteSupabaseIntegration(
  projectId: string,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "supabase")
    .eq("project_id", projectId);

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: !error };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function pingSupabase(
  projectUrl: string,
  key: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${projectUrl}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, error: `Could not reach project: HTTP ${res.status} ${res.statusText}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

async function fetchSchemaFromUrl(
  projectUrl: string,
  key: string,
): Promise<{ ok: boolean; tables?: TableInfo[]; error?: string }> {
  try {
    const res = await fetch(`${projectUrl}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    // PostgREST returns an OpenAPI spec at the root endpoint.
    // The `definitions` section maps table name → column info.
    const spec = (await res.json()) as {
      definitions?: Record<
        string,
        {
          properties?: Record<string, { type?: string; format?: string }>;
        }
      >;
    };

    const tables: TableInfo[] = Object.entries(spec.definitions ?? {}).map(
      ([name, def]) => ({
        name,
        columns: Object.entries(def.properties ?? {}).map(([col, info]) => ({
          name: col,
          type: info.format ?? info.type ?? "unknown",
        })),
      }),
    );

    return { ok: true, tables };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Schema fetch failed" };
  }
}
