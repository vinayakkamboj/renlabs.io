-- Ren Labs — Astra chat usage limiting.
--
-- A per-user, per-day message counter so the conversational chatbot can't be
-- abused. The increment RPC uses the CALLER's identity (auth.uid()), so a user
-- can only ever spend their own quota.

CREATE TABLE IF NOT EXISTS public.chat_usage (
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date    NOT NULL DEFAULT current_date,
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own chat usage" ON public.chat_usage;
CREATE POLICY "read own chat usage"
  ON public.chat_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Atomically count one message against today's quota. Returns
-- { ok, used, remaining }. ok=false means the daily limit is reached.
CREATE OR REPLACE FUNCTION public.increment_chat_usage(p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'used', 0, 'remaining', 0);
  END IF;

  INSERT INTO public.chat_usage (user_id, usage_date, count)
  VALUES (v_uid, current_date, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT count INTO v_count
  FROM public.chat_usage
  WHERE user_id = v_uid AND usage_date = current_date
  FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('ok', false, 'used', v_count, 'remaining', 0);
  END IF;

  UPDATE public.chat_usage
  SET count = count + 1
  WHERE user_id = v_uid AND usage_date = current_date;

  RETURN jsonb_build_object(
    'ok', true,
    'used', v_count + 1,
    'remaining', p_limit - (v_count + 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_chat_usage TO authenticated, service_role;
