"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupabaseIntegration {
  id: string;
  projectUrl: string;
  anonKey: string;
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

export async function getSupabaseIntegration(): Promise<SupabaseIntegration | null> {
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
    .maybeSingle();

  if (!data) return null;
  const cfg = data.config as Record<string, string>;
  return {
    id: data.id,
    projectUrl: cfg.project_url ?? "",
    anonKey: cfg.anon_key ?? "",
    hasServiceRoleKey: !!cfg.service_role_key,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function getSupabaseSchema(): Promise<{
  ok: boolean;
  tables?: TableInfo[];
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Not configured." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data } = await supabase
    .from("user_integrations")
    .select("config")
    .eq("user_id", user.id)
    .eq("kind", "supabase")
    .maybeSingle();

  if (!data) return { ok: false, error: "No Supabase integration connected." };
  const cfg = data.config as Record<string, string>;
  return fetchSchemaFromUrl(cfg.project_url, cfg.service_role_key || cfg.anon_key);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function saveSupabaseIntegration(input: {
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

  const url = input.projectUrl.trim().replace(/\/$/, "");
  const anonKey = input.anonKey.trim();
  const serviceKey = input.serviceRoleKey.trim();

  // Validate the connection before saving.
  const test = await pingSupabase(url, serviceKey || anonKey);
  if (!test.ok) return { ok: false, error: test.error };

  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: user.id,
      kind: "supabase",
      config: {
        project_url: url,
        anon_key: anonKey,
        service_role_key: serviceKey,
      },
      status: "connected",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/integrations");
  return { ok: true };
}

export async function deleteSupabaseIntegration(): Promise<{ ok: boolean }> {
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
    .eq("kind", "supabase");

  revalidatePath("/dashboard/integrations");
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
