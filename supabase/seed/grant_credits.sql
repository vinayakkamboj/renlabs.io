-- ───────────────────────────────────────────────────────────────────────────
-- Ren Labs — grant credits to a user by email (manual one-off).
--
-- WHEN TO USE
--   You normally grant credits from the admin panel:
--     Admin → Users → (pick the user) → "Grant credits".
--   Use this script only for the very first top-up (e.g. seeding the founder's
--   own account so you can test Ren Code) or if you prefer the SQL editor.
--
-- HOW TO RUN
--   1. Make sure the credit + admin backend is applied. Run, in order, in the
--      Supabase SQL editor (each is idempotent / safe to re-run):
--        supabase/migrations/20260613_credits.sql
--        supabase/migrations/20260618_free_generation.sql
--        supabase/migrations/20260619_admin.sql
--   2. Set the two variables below, then run this whole file.
--
-- This routes through the same audited admin_grant_credits() RPC the panel
-- uses, so the grant lands in the ledger exactly like a panel grant would.
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- ── EDIT THESE TWO LINES ──────────────────────────────────────────────────
  v_email  text    := 'getsubit@gmail.com';  -- who to credit
  v_amount integer := 5000;                   -- credits to add ($50.00 of test budget)
  -- ──────────────────────────────────────────────────────────────────────────
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for email %. Sign in once first, then re-run.', v_email;
  END IF;

  v_result := public.admin_grant_credits(
    p_user_id => v_user_id,
    p_amount  => v_amount,
    p_note    => 'Founder testing budget (seed)',
    p_actor   => 'seed-script'
  );

  RAISE NOTICE 'Granted % credits to % (user %). New balance: %',
    v_amount, v_email, v_user_id, v_result->>'balance';
END $$;
