-- Ren Labs — AI Workspace: agents, tasks, reports, and activity feed.
--
-- Positioning: users create projects and deploy AI agents to work on them.
-- An agent belongs to a project, executes tasks, and produces reports. The
-- activity feed records continuous work across the workspace. Every table is
-- row-level-secured to the owning user, matching the existing schema.

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type agent_role as enum (
  'research', 'developer', 'qa', 'marketing', 'support', 'design', 'ops'
);
create type agent_status as enum ('idle', 'active', 'paused', 'error');
create type task_status  as enum ('queued', 'in_progress', 'blocked', 'done', 'failed');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type activity_kind as enum (
  'agent_deployed', 'agent_status', 'task_created', 'task_completed',
  'report_generated', 'note'
);

-- ─── Project goals ───────────────────────────────────────────────────────────
-- Lightweight: a project carries a list of current goals shown on its page.

alter table public.projects
  add column if not exists goals text[] not null default '{}';

-- ─── Agents ──────────────────────────────────────────────────────────────────

create table public.agents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  name         text not null,
  role         agent_role not null,
  goal         text,
  status       agent_status not null default 'idle',
  schedule     text not null default 'manual',   -- manual | hourly | daily | weekly
  budget_cents  integer not null default 0,       -- spend cap (0 = unlimited)
  spent_cents   integer not null default 0,
  permissions  text[] not null default '{}',
  memory       jsonb not null default '{}'::jsonb,
  last_run_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Tasks ───────────────────────────────────────────────────────────────────

create table public.agent_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  agent_id     uuid references public.agents (id) on delete set null,
  title        text not null,
  detail       text,
  status       task_status not null default 'queued',
  priority     task_priority not null default 'medium',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- ─── Reports ─────────────────────────────────────────────────────────────────

create table public.agent_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  agent_id     uuid references public.agents (id) on delete set null,
  task_id      uuid references public.agent_tasks (id) on delete set null,
  title        text not null,
  summary      text,
  content      text,
  created_at   timestamptz not null default now()
);

-- ─── Activity feed ───────────────────────────────────────────────────────────

create table public.activity_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  agent_id     uuid references public.agents (id) on delete set null,
  kind         activity_kind not null,
  message      text not null,
  created_at   timestamptz not null default now()
);

-- ─── Row-level security ──────────────────────────────────────────────────────

alter table public.agents          enable row level security;
alter table public.agent_tasks     enable row level security;
alter table public.agent_reports   enable row level security;
alter table public.activity_events enable row level security;

create policy "own agents" on public.agents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own agent tasks" on public.agent_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own agent reports" on public.agent_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own activity events" on public.activity_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_agents_user on public.agents (user_id, updated_at desc);
create index idx_agents_project on public.agents (project_id);
create index idx_tasks_user on public.agent_tasks (user_id, updated_at desc);
create index idx_tasks_project on public.agent_tasks (project_id, status);
create index idx_tasks_agent on public.agent_tasks (agent_id);
create index idx_reports_user on public.agent_reports (user_id, created_at desc);
create index idx_reports_project on public.agent_reports (project_id, created_at desc);
create index idx_activity_user on public.activity_events (user_id, created_at desc);
create index idx_activity_project on public.activity_events (project_id, created_at desc);
