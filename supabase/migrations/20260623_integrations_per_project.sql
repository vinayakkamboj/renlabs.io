-- Make integrations per-project.
--
-- A user can connect a DIFFERENT Supabase backend to each of their projects, so
-- the integration is scoped by project_id (not just by user). Credentials remain
-- in the RLS-protected `config` JSONB and are additionally encrypted at rest by
-- the application layer (AES-256-GCM) before they are ever written here.

alter table public.user_integrations
  add column if not exists project_id uuid
    references public.projects (id) on delete cascade;

-- Drop the old user-level uniqueness so the same kind can exist per project.
alter table public.user_integrations
  drop constraint if exists user_integrations_user_id_kind_key;

-- One integration per (user, kind, project). project_id is always set for the
-- Supabase backend connection, so this enforces a single backend per project.
create unique index if not exists user_integrations_user_kind_project
  on public.user_integrations (user_id, kind, project_id);

create index if not exists idx_integrations_project
  on public.user_integrations (project_id);
