-- Background build jobs — a build runs server-side as an agentic loop and
-- survives the user closing the browser. The client creates a job, polls its
-- status, and pulls the resulting files from project_files when it completes.

create table public.build_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  status          text not null default 'queued'
                  check (status in ('queued','thinking','writing','verifying','repairing','applying','done','error','cancelled')),
  prompt          text not null,
  -- Chat context snapshot ([{role, content}]) captured at submit time.
  messages        jsonb not null default '[]'::jsonb,
  is_first_build  boolean not null default false,
  -- Live activity feed: [{t: epoch_ms, kind, text}] appended as the loop works.
  steps           jsonb not null default '[]'::jsonb,
  -- Result summary for the chat bubble + file chips.
  result_summary  text,
  changed_paths   jsonb not null default '[]'::jsonb,
  error           text,
  cancelled       boolean not null default false,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  credits_deducted integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

alter table public.build_jobs enable row level security;

create policy "own build jobs" on public.build_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_build_jobs_project on public.build_jobs (project_id, created_at desc);
create index idx_build_jobs_user on public.build_jobs (user_id);
