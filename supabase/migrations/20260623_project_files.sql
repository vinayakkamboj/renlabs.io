-- Project file persistence for agent-based editing

create table public.project_files (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  path            text not null,
  content         text not null,
  language        text,
  updated_at      timestamptz not null default now(),
  unique (project_id, path)
);

alter table public.project_files enable row level security;

create policy "own project files" on public.project_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_project_files_project on public.project_files (project_id);
create index idx_project_files_user on public.project_files (user_id);
