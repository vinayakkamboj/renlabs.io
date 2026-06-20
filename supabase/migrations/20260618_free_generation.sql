-- Ren Labs — switch the free tier from "100 free credits" to "1 free generation".
--
-- New users now start with 0 credits and 1 free build. The build gate consumes
-- the free generation first; once it's used, builds cost credits as normal.
-- Safe to re-run.

-- ── 1. Add the free-generation counter ──────────────────────────────────────
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS free_generations integer NOT NULL DEFAULT 1;

-- New accounts shouldn't get the old 100-credit default anymore.
ALTER TABLE public.user_credits ALTER COLUMN balance SET DEFAULT 0;

-- ── 2. Deduction RPC: spend a free generation before charging credits ───────
CREATE OR REPLACE FUNCTION public.deduct_build_credits(
  p_user_id    uuid,
  p_amount     integer,
  p_tier       text,
  p_project_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance      integer;
  v_free         integer;
  v_new_balance  integer;
BEGIN
  SELECT balance, free_generations INTO v_balance, v_free
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, balance, free_generations)
    VALUES (p_user_id, 0, 1)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance, free_generations INTO v_balance, v_free
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;

  -- Free generation takes priority — no credits spent.
  IF v_free > 0 THEN
    UPDATE public.user_credits
    SET free_generations = free_generations - 1,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO public.credit_transactions
      (user_id, amount, type, tier, project_id, description, balance_after)
    VALUES
      (p_user_id, 0, 'build_usage', p_tier, p_project_id,
       'Free generation', v_balance);

    RETURN jsonb_build_object(
      'ok', true, 'balance', v_balance, 'deducted', 0, 'free_used', true
    );
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'insufficient_credits',
      'balance', v_balance, 'cost', p_amount
    );
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE public.user_credits
  SET balance = v_new_balance,
      lifetime_used = lifetime_used + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions
    (user_id, amount, type, tier, project_id, description, balance_after)
  VALUES
    (p_user_id, -p_amount, 'build_usage', p_tier, p_project_id,
     'Astra build', v_new_balance);

  RETURN jsonb_build_object(
    'ok', true, 'balance', v_new_balance, 'deducted', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_build_credits TO service_role;

-- ── 3. Signup trigger: 0 credits + 1 free generation ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, free_generations)
  VALUES (NEW.id, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();
