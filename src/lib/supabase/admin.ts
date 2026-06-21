import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. NEVER import this from client
 * code, and only ever call it behind an admin authorization check
 * (see lib/auth/admin.ts). It reads SUPABASE_SERVICE_ROLE_KEY, which must only
 * exist on the server.
 */
export function isAdminDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
