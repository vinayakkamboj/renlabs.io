-- ───────────────────────────────────────────────────────────────────────────
-- Ren Labs — "which migrations are live in Supabase?" status report.
--
-- Supabase has no built-in list of which of OUR SQL files have been run, so
-- this query figures it out by checking whether each migration's key object
-- (a table, column, or function it creates) actually exists in the database.
--
-- HOW TO USE
--   Paste this whole file into the Supabase SQL editor and run it. You'll get
--   one row per migration with ✅ applied / ❌ MISSING. Run any ❌ file from
--   supabase/migrations/ (in date order), then re-run this to confirm.
--
-- Safe and read-only — it changes nothing.
-- ───────────────────────────────────────────────────────────────────────────

WITH checks(ord, migration, proves, applied) AS (
  VALUES
    (1, '0001_init.sql',              'table profiles',
        to_regclass('public.profiles')           IS NOT NULL),
    (2, '0002_product.sql',           'table projects',
        to_regclass('public.projects')           IS NOT NULL),
    (3, '20260613_credits.sql',       'tables user_credits + credit_transactions',
        to_regclass('public.user_credits')       IS NOT NULL
        AND to_regclass('public.credit_transactions') IS NOT NULL),
    (4, '20260616_collaboration.sql', 'table project_files',
        to_regclass('public.project_files')      IS NOT NULL),
    (5, '20260617_api_keys.sql',      'table api_keys',
        to_regclass('public.api_keys')           IS NOT NULL),
    (6, '20260618_free_generation.sql','column user_credits.free_generations',
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='user_credits'
                  AND column_name='free_generations')),
    (7, '20260619_admin.sql',         'func admin_grant_credits + table admin_audit_log',
        EXISTS (SELECT 1 FROM pg_proc WHERE proname='admin_grant_credits')
        AND to_regclass('public.admin_audit_log') IS NOT NULL),
    (8, '20260620_chat.sql',          'table chat_usage',
        to_regclass('public.chat_usage')         IS NOT NULL),
    (9, '20260622_roles.sql',         'profiles.role allows support',
        EXISTS (SELECT 1 FROM information_schema.check_constraints
                WHERE constraint_schema = 'public'
                  AND constraint_name   = 'profiles_role_check'
                  AND check_clause LIKE '%support%'))
)
SELECT
  migration,
  proves                                                     AS "key object checked",
  CASE WHEN applied THEN '✅ applied'
       ELSE '❌ MISSING — run this file' END                 AS status
FROM checks
ORDER BY ord;
