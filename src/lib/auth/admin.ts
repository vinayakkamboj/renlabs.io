import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AdminRole } from "./roles";
import { hasMinRole } from "./roles";

export type { AdminRole };

export interface AdminUser {
  id: string;
  email: string;
  /** Role in the admin hierarchy (support → admin → superadmin). */
  role: AdminRole;
  /** Convenience shorthand: role === "superadmin". */
  isSuperAdmin: boolean;
}

/**
 * Hardcoded founder accounts. Always superadmin regardless of DB state.
 * Keep this list as small as possible.
 */
const SUPERADMIN_EMAILS = [
  "vinayakkamboj01@gmail.com",
  "vinayak@renlabs.io",
];

function isHardcodedSuperAdmin(email: string): boolean {
  return SUPERADMIN_EMAILS.includes(email.toLowerCase());
}

/** Additional admins granted via the ADMIN_EMAILS env var (comma-separated). */
function envAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the current session user as an AdminUser if they have any admin
 * panel access, otherwise null.
 *
 * Priority order:
 *   1. Hardcoded superadmins (SUPERADMIN_EMAILS)      → role: superadmin
 *   2. ADMIN_EMAILS env allowlist                     → role: admin
 *   3. profiles.role = "admin"                        → role: admin
 *   4. profiles.role = "support"                      → role: support
 *   5. Everything else (member, researcher, …)        → null (no panel access)
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = (user.email ?? "").toLowerCase();

  if (isHardcodedSuperAdmin(email)) {
    return { id: user.id, email, role: "superadmin", isSuperAdmin: true };
  }

  if (envAdminEmails().includes(email)) {
    return { id: user.id, email, role: "admin", isSuperAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const dbRole = (profile?.role ?? "") as string;

  if (dbRole === "admin") {
    return { id: user.id, email, role: "admin", isSuperAdmin: false };
  }
  if (dbRole === "support") {
    return { id: user.id, email, role: "support", isSuperAdmin: false };
  }

  return null;
}

// ── Guards ────────────────────────────────────────────────────────────────────
// Call these at the top of every server action / route that touches admin data.

/** Throws if the caller has no admin panel access at all. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("not_authorized");
  return admin;
}

/** Throws if the caller cannot grant or deduct credits (support+). */
export async function requireCreditsAccess(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!hasMinRole(admin.role, "support")) throw new Error("not_authorized");
  return admin;
}

/** Throws if the caller doesn't have full admin panel access (admin+). */
export async function requireFullAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!hasMinRole(admin.role, "admin")) throw new Error("not_authorized");
  return admin;
}

/** Throws if the caller is not a hardcoded superadmin. */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) throw new Error("not_authorized");
  return admin;
}
