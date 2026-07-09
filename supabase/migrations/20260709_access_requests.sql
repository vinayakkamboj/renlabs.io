-- Private-beta trial requests + DB-backed allowlist.
--
-- Any signed-in user outside the static allowlist can request trial access
-- from /restricted. Admins review requests at admin.renlabs.io/access.
-- An APPROVED row is itself the grant: the middleware and every compute API
-- treat status='approved' as allowlisted, so approving a request is the only
-- action needed to let a user in.

create table if not exists public.access_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  email       text not null,
  note        text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  text
);

create index if not exists access_requests_status_idx
  on public.access_requests (status, created_at desc);

alter table public.access_requests enable row level security;

-- Users see and create only their own request; updates (decisions) happen
-- exclusively through the service-role admin client.
drop policy if exists "users read own access request" on public.access_requests;
create policy "users read own access request"
  on public.access_requests for select
  using (auth.uid() = user_id);

drop policy if exists "users create own access request" on public.access_requests;
create policy "users create own access request"
  on public.access_requests for insert
  with check (auth.uid() = user_id);
