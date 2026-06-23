-- User integrations — third-party service connections stored per user.
-- Each (user_id, kind) pair is unique so upsert is idempotent.
-- Credentials are stored inside the config JSONB column and protected
-- by RLS so only the owning user can ever read or write them.

create table public.user_integrations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,              -- 'supabase', 'openai', etc.
  label       text,                       -- optional user-given display label
  config      jsonb not null default '{}', -- service-specific connection details
  status      text not null default 'connected',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind)
);

alter table public.user_integrations enable row level security;

create policy "own integrations" on public.user_integrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_integrations_user on public.user_integrations (user_id);
