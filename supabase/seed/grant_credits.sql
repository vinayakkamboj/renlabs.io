-- ───────────────────────────────────────────────────────────────────────────
-- Ren Labs — grant credits to founder accounts (manual one-off).
--
-- Grants test budget to both founder emails. Safe to re-run (balances just
-- increase). Routed through the audited admin_grant_credits() RPC so every
-- grant lands in the ledger exactly like a panel grant.
--
-- HOW TO RUN
--   1. Confirm migrations are applied (run seed/check_migrations.sql first).
--   2. Sign in to the app with the account you want to credit, THEN run this.
--   3. Paste into the Supabase SQL editor and click Run.
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_amount  integer := 5000;   -- credits per account ($50.00 test budget each)
  v_email   text;
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  FOREACH v_email IN ARRAY ARRAY['vinayakkamboj01@gmail.com', 'vinayak@renlabs.io']
  LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email);

    IF v_user_id IS NULL THEN
      RAISE NOTICE 'Skipping % — not found in auth.users (sign in once first).', v_email;
      CONTINUE;
    END IF;

    v_result := public.admin_grant_credits(
      p_user_id => v_user_id,
      p_amount  => v_amount,
      p_note    => 'Founder testing budget (seed)',
      p_actor   => 'seed-script'
    );

    RAISE NOTICE 'Granted % credits to % (user %). New balance: %',
      v_amount, v_email, v_user_id, v_result->>'balance';
  END LOOP;
END $$;
