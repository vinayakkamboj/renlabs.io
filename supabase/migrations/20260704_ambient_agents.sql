-- Ambient agents: server-side agent loops with burn-rate control and a
-- separate working branch so autonomous edits never touch main directly.

-- Loop scheduling + rate limiting on agents.
alter table public.agents
  add column if not exists loop_enabled boolean not null default false,
  add column if not exists rate_tokens_per_min integer not null default 1500,
  add column if not exists next_run_at timestamptz,
  add column if not exists consecutive_failures integer not null default 0;

create index if not exists idx_agents_loop_due
  on public.agents (loop_enabled, next_run_at);

-- Branch isolation for files: agents write to branch 'ren'; the app serves
-- 'main'. Promoting merges ren -> main explicitly.
alter table public.project_files
  add column if not exists branch text not null default 'main';

alter table public.project_files
  drop constraint if exists project_files_project_id_path_key;

alter table public.project_files
  add constraint project_files_project_path_branch_key
  unique (project_id, path, branch);
