"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Generate a Ren API key, returning the raw value plus storage-safe parts. */
function generateKey(): { raw: string; hash: string; prefix: string } {
  // URL-safe secret; ~43 chars of entropy.
  const secret = randomBytes(32).toString("base64url");
  const raw = `ren_sk_live_${secret}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = `ren_sk_live_${secret.slice(0, 4)}…${secret.slice(-4)}`;
  return { raw, hash, prefix };
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((k) => ({
    id: k.id as string,
    name: k.name as string,
    keyPrefix: k.key_prefix as string,
    lastUsedAt: (k.last_used_at as string) ?? null,
    revokedAt: (k.revoked_at as string) ?? null,
    createdAt: k.created_at as string,
  }));
}

/**
 * Create a key. Returns the full plaintext key ONCE — it is never retrievable
 * again, only its masked prefix.
 */
export async function createApiKey(
  name: string,
): Promise<
  | { ok: true; key: string; row: ApiKeyRow }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "API keys require Supabase to be configured." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = name.trim().slice(0, 60) || "Default key";
  const { raw, hash, prefix } = generateKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      name: trimmed,
      key_prefix: prefix,
      key_hash: hash,
    })
    .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: "Couldn't create the key. Try again." };
  }

  return {
    ok: true,
    key: raw,
    row: {
      id: data.id as string,
      name: data.name as string,
      keyPrefix: data.key_prefix as string,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: data.created_at as string,
    },
  };
}

/** Revoke (disable) a key. It can no longer authenticate requests. */
export async function revokeApiKey(id: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  return { ok: !error };
}

/** Permanently delete a revoked key from the list. */
export async function deleteApiKey(id: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return { ok: !error };
}
