-- Public preview links: an unguessable URL that renders a project's built app
-- to ANYONE who has the link — no account, no sign-in — so users can show
-- their site before it exists anywhere on the internet. Each share mints a
-- fresh unique token; the public page reads via the service-role client, so
-- no anon RLS policy is needed.

create table if not exists public.preview_links (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.preview_links enable row level security;

create policy "own preview links" on public.preview_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_preview_links_token on public.preview_links (token);
create index if not exists idx_preview_links_project on public.preview_links (project_id);
