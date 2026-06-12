-- Ren AI — Supabase schema, phase 1
-- Auth-adjacent tables: profiles, playground persistence, API usage logging.
-- Apply via the Supabase SQL editor, or `npx supabase db push` with a linked project.

-- ─── Profiles ────────────────────────────────────────────────────────────────
-- One row per auth user, created automatically on signup.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  display_name text,
  role        text not null default 'member' check (role in ('member', 'researcher', 'admin')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Playground persistence ──────────────────────────────────────────────────

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'Untitled',
  model_id    text not null default 'ren-1',
  -- Consent flag: only opted-in conversations may become training data.
  training_ok boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Users manage own conversations"
  on public.conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage messages in own conversations"
  on public.messages for all
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create index if not exists idx_conversations_user on public.conversations (user_id, updated_at desc);
create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);

-- ─── API usage logging ───────────────────────────────────────────────────────
-- One row per /api/chat request; feeds rate limiting and the dashboard.

create table if not exists public.api_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  model_id    text not null,
  latency_ms  integer,
  ok          boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.api_usage enable row level security;

create policy "Users read own usage"
  on public.api_usage for select
  using (auth.uid() = user_id);

-- Inserts happen server-side with the service-role key (bypasses RLS);
-- no insert policy for the anon role on purpose.

create index if not exists idx_api_usage_user_time on public.api_usage (user_id, created_at desc);
