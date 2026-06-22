-- Ren Labs — add the "support" role to the profiles table.
--
-- Previously the only roles with any admin-panel access were "admin" and the
-- hardcoded superadmins.  "support" is a new scoped role for customer-support
-- staff: they can view the Users section and grant / deduct credits, but cannot
-- see Payments, Projects, or Audit, and cannot change anyone's role.
--
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE patterns throughout).

-- ── 1. Widen the profiles.role check constraint ──────────────────────────────
-- Postgres names auto-generated CHECK constraints "<table>_<col>_check".
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member', 'researcher', 'support', 'admin'));

-- ── 2. Update check_migrations helper (informational comment only) ───────────
-- Run seed/check_migrations.sql again after applying this file — it will show
-- this migration as ✅ applied once the constraint exists.
