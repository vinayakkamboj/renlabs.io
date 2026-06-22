-- Ren Labs — admin backend: manual credit grants + an audit trail.
--
-- All admin mutations go through SECURITY DEFINER RPCs callable only by the
-- service_role (which the server uses behind an admin-auth check). No anon/
-- authenticated policies are granted on these tables/functions, so a stolen
-- anon key can never touch them.

-- ── Allow an 'admin_grant' transaction type ─────────────────────────────────
ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN ('signup_bonus', 'purchase', 'build_usage', 'refund', 'admin_grant'));

-- ── Audit log of every admin action ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       uuid,
  actor_email    text,
  action         text NOT NULL,
  target_user_id uuid,
  detail         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_created_idx
  ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service role (RLS-bypassing) can read/write.

-- ── Atomic credit grant ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  p_user_id uuid,
  p_amount  integer,
  p_note    text,
  p_actor   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_new     integer;
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_new := GREATEST(0, v_balance + p_amount);

  UPDATE public.user_credits
  SET balance = v_new,
      lifetime_purchased = lifetime_purchased + GREATEST(p_amount, 0),
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions
    (user_id, amount, type, description, balance_after)
  VALUES
    (p_user_id, p_amount, 'admin_grant',
     COALESCE(NULLIF(p_note, ''), 'Admin grant') || ' · by ' || COALESCE(p_actor, 'admin'),
     v_new);

  RETURN jsonb_build_object('ok', true, 'balance', v_new);
END;
$$;

-- ── Set a user's remaining free generations ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_free_generations(
  p_user_id uuid,
  p_count   integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, free_generations)
  VALUES (p_user_id, 0, GREATEST(p_count, 0))
  ON CONFLICT (user_id)
  DO UPDATE SET free_generations = GREATEST(p_count, 0), updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_free_generations TO service_role;
