-- Usage-based billing: every model call is recorded as a usage event with its
-- real token counts and the credits charged for it. Charging is atomic
-- (row-locked) and independent of the old fixed-fee/free-generation path.
-- New signups get 50 free credits (granted app-side via SIGNUP_BONUS_CREDITS).

create table if not exists public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  project_id    uuid,
  job_id        uuid,
  kind          text not null default 'build_pass',
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  credits       integer not null default 0,
  -- True when the stream was cut before the provider reported usage and the
  -- token counts are conservative estimates from text length.
  estimated     boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.usage_events enable row level security;

create policy "own usage events" on public.usage_events
  for select using (auth.uid() = user_id);

create index if not exists idx_usage_events_user on public.usage_events (user_id, created_at desc);
create index if not exists idx_usage_events_job on public.usage_events (job_id);

-- Atomic usage charge: locks the balance row, deducts if sufficient, and
-- reports the outcome. No free-generation involvement — pure credit spend.
create or replace function public.deduct_usage_credits(
  p_user_id uuid,
  p_amount  integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  select balance into v_balance
    from public.user_credits
   where user_id = p_user_id
   for update;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'no_account');
  end if;

  if v_balance < p_amount then
    return jsonb_build_object(
      'ok', false, 'error', 'insufficient_credits', 'balance', v_balance
    );
  end if;

  update public.user_credits
     set balance = balance - p_amount,
         lifetime_used = lifetime_used + p_amount,
         updated_at = now()
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'balance', v_balance - p_amount, 'deducted', p_amount);
end;
$$;
