import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

/**
 * Built-in superadmin(s). Always have full admin access regardless of env
 * config or database role. Keep this list tiny. Both spellings of the founder's
 * email are included to be safe.
 */
const SUPERADMINS = [
  "vinayakkamboj01@gmail.com",
  "vinayak@renlabs.io",
];

function isSuperAdmin(email: string): boolean {
  return SUPERADMINS.includes(email.toLowerCase());
}

/** Emails granted admin access via the ADMIN_EMAILS env allowlist. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the current user if they are an admin, else null. A user is an admin
 * if they are a built-in superadmin, their email is in the ADMIN_EMAILS
 * allowlist, or their profile role is 'admin'. Read-only — never mutates.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = (user.email ?? "").toLowerCase();

  if (email && isSuperAdmin(email)) {
    return { id: user.id, email, isSuperAdmin: true };
  }

  if (email && adminEmails().includes(email)) {
    return { id: user.id, email, isSuperAdmin: false };
  }

  // Fall back to a role flag on the user's own profile (readable under RLS).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") {
    return { id: user.id, email, isSuperAdmin: false };
  }

  return null;
}

/**
 * Guard for admin server actions — throws if the caller is not an admin. Always
 * call this at the top of any admin mutation before touching the service-role
 * client. (Pages use getAdminUser() and render an access-denied state instead,
 * to avoid redirect loops on the admin subdomain.)
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("not_authorized");
  return admin;
}

/** Throws unless the caller is a built-in superadmin. */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) throw new Error("not_authorized");
  return admin;
}
