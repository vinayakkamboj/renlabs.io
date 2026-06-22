/**
 * Role hierarchy for the Ren Labs admin panel.
 *
 * Pure types and helpers — no server imports. Safe to use in both server
 * components and client components (admin-shell, admin-user-manager, etc.).
 *
 * Role hierarchy (lowest → highest):
 *   support  → can view Users, grant credits, set free generations
 *   admin    → full panel access (all nav items) + everything support can do
 *   superadmin → hardcoded founders; everything + can assign roles to others
 *
 * Regular users (member, researcher) never appear in this type — they have no
 * admin panel access at all.
 */

export const ADMIN_ROLE_ORDER = ["support", "admin", "superadmin"] as const;
export type AdminRole = (typeof ADMIN_ROLE_ORDER)[number];

/** True if `userRole` meets or exceeds `minimum` in the hierarchy. */
export function hasMinRole(userRole: AdminRole, minimum: AdminRole): boolean {
  return ADMIN_ROLE_ORDER.indexOf(userRole) >= ADMIN_ROLE_ORDER.indexOf(minimum);
}

// ── Permission helpers ────────────────────────────────────────────────────────
// Use these everywhere instead of raw role comparisons so adding a new role
// never requires hunting down string literals across the codebase.

/** Can view the admin panel at all (any admin-level role). */
export function canAccessPanel(role: AdminRole): boolean {
  return hasMinRole(role, "support");
}

/** Can grant or deduct credits and set free generations for any user. */
export function canGrantCredits(role: AdminRole): boolean {
  return hasMinRole(role, "support");
}

/** Can view Payments, Projects, and Audit pages. */
export function canAccessFullPanel(role: AdminRole): boolean {
  return hasMinRole(role, "admin");
}

/** Can assign / change another user's role. Superadmin only. */
export function canSetRoles(role: AdminRole): boolean {
  return hasMinRole(role, "superadmin");
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<AdminRole, string> = {
  support: "Support",
  admin: "Admin",
  superadmin: "Superadmin",
};

/** All DB role values a superadmin can assign to another user. */
export const ASSIGNABLE_ROLES = [
  "member",
  "researcher",
  "support",
  "admin",
] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
