-- Ren Code — collaboration: shared project files + email-based invitations
--
-- Adds the two tables the app already references (project_files,
-- project_collaborators) and the RLS needed so a project owner *and* the
-- people they invite (who must already have a Ren Code account) can read and
-- edit a shared project. Invitations are surfaced to the invitee as a request
-- they explicitly accept or decline.

-- ── Shared project files (project-scoped, not per-user) ─────────────────────
create table if not exists public.project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,  -- last editor
  path        text not null,
  content     text not null default '',
  updated_at  timestamptz not null default now(),
  unique (project_id, path)
);

-- ── Collaboration invitations ───────────────────────────────────────────────
-- An invitation always targets an existing Ren Code account (invited_user_id is
-- resolved from the email at invite time). project_name / invited_by_email are
-- denormalized so the invitee can render the request without being able to read
-- the owner's project or profile rows.
create table if not exists public.project_collaborators (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  invited_email    text not null,
  invited_user_id  uuid references auth.users (id) on delete cascade,
  invited_by       uuid not null references auth.users (id) on delete cascade,
  invited_by_email text,
  project_name     text,
  status           text not null default 'pending'
                   check (status in ('pending', 'accepted', 'declined')),
  created_at       timestamptz not null default now(),
  responded_at     timestamptz,
  unique (project_id, invited_email)
);

create index if not exists idx_pf_project on public.project_files (project_id);
create index if not exists idx_pc_invitee on public.project_collaborators (invited_user_id, status);
create index if not exists idx_pc_project on public.project_collaborators (project_id);

-- ── Helper functions ────────────────────────────────────────────────────────
-- SECURITY DEFINER so they bypass RLS internally — this prevents infinite
-- recursion between the projects and project_collaborators policies.

create or replace function public.is_project_owner(p_project uuid, p_uid uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.projects where id = p_project and user_id = p_uid
  );
$$;

create or replace function public.is_project_collaborator(p_project uuid, p_uid uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.project_collaborators
    where project_id = p_project
      and invited_user_id = p_uid
      and status = 'accepted'
  );
$$;

-- Resolve a user id from an email. Lets the inviter check that the invitee has
-- an account without being able to read other users' profile rows directly.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid language sql security definer set search_path = '' stable as $$
  select id from public.profiles where lower(email) = lower(p_email) limit 1;
$$;

grant execute on function public.is_project_owner(uuid, uuid) to authenticated;
grant execute on function public.is_project_collaborator(uuid, uuid) to authenticated;
grant execute on function public.find_user_id_by_email(text) to authenticated;

-- ── RLS: project_files ──────────────────────────────────────────────────────
alter table public.project_files enable row level security;

drop policy if exists "members read project files" on public.project_files;
create policy "members read project files" on public.project_files
  for select using (
    public.is_project_owner(project_id, auth.uid())
    or public.is_project_collaborator(project_id, auth.uid())
  );

drop policy if exists "members insert project files" on public.project_files;
create policy "members insert project files" on public.project_files
  for insert with check (
    public.is_project_owner(project_id, auth.uid())
    or public.is_project_collaborator(project_id, auth.uid())
  );

drop policy if exists "members update project files" on public.project_files;
create policy "members update project files" on public.project_files
  for update using (
    public.is_project_owner(project_id, auth.uid())
    or public.is_project_collaborator(project_id, auth.uid())
  );

drop policy if exists "members delete project files" on public.project_files;
create policy "members delete project files" on public.project_files
  for delete using (
    public.is_project_owner(project_id, auth.uid())
    or public.is_project_collaborator(project_id, auth.uid())
  );

-- ── RLS: project_collaborators ──────────────────────────────────────────────
alter table public.project_collaborators enable row level security;

-- Owner sees the invitations they sent; invitee sees invitations addressed to them.
drop policy if exists "see own invitations" on public.project_collaborators;
create policy "see own invitations" on public.project_collaborators
  for select using (
    invited_by = auth.uid() or invited_user_id = auth.uid()
  );

-- Only a project's owner can create invitations on it.
drop policy if exists "owner creates invitations" on public.project_collaborators;
create policy "owner creates invitations" on public.project_collaborators
  for insert with check (
    invited_by = auth.uid() and public.is_project_owner(project_id, auth.uid())
  );

-- Owner can manage; invitee can respond (accept / decline).
drop policy if exists "respond or manage invitations" on public.project_collaborators;
create policy "respond or manage invitations" on public.project_collaborators
  for update using (
    invited_by = auth.uid() or invited_user_id = auth.uid()
  );

drop policy if exists "owner removes invitations" on public.project_collaborators;
create policy "owner removes invitations" on public.project_collaborators
  for delete using (invited_by = auth.uid());

-- ── Let accepted collaborators read the shared project itself ───────────────
drop policy if exists "collaborators read projects" on public.projects;
create policy "collaborators read projects" on public.projects
  for select using (public.is_project_collaborator(id, auth.uid()));
