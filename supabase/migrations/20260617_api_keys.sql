-- Ren Labs — API keys for the developer console.
--
-- Each row is one key a user created to call the Ren API. We never store the
-- raw key: only a SHA-256 hash (for verification at the API edge) and a masked
-- prefix (for display). The plaintext key is shown to the user exactly once, at
-- creation time.

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null default 'Default key',
  key_prefix   text not null,          -- masked, e.g. ren_sk_live_ab12…wxyz
  key_hash     text not null,          -- sha-256 of the full key
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_api_keys_user on public.api_keys (user_id, created_at desc);
create unique index if not exists idx_api_keys_hash on public.api_keys (key_hash);

alter table public.api_keys enable row level security;

drop policy if exists "own api keys" on public.api_keys;
create policy "own api keys" on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
