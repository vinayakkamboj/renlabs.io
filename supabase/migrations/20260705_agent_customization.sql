-- Agent customization: owner-defined rules, working hours, and token budgets.
--
-- Every ambient agent becomes fully configurable from the dashboard:
--   · instructions        — free-text rules the agent must follow every run
--   · focus               — what the agent works on (scope), beyond its goal
--   · working hours       — [start, end) hour window + days, in a named
--                           timezone; the scheduler only runs the agent inside
--                           the window (manual "Run now" clicks always work)
--   · max_tokens_per_run  — hard output cap per cycle
--   · daily_token_budget  — total tokens/day; the loop sleeps to next midnight
--                           once exhausted (tracked in tokens_spent_today)

alter table public.agents
  add column if not exists instructions text,
  add column if not exists focus text,
  add column if not exists working_hours_start smallint,
  add column if not exists working_hours_end smallint,
  add column if not exists working_days smallint[],
  add column if not exists timezone text not null default 'UTC',
  add column if not exists max_tokens_per_run integer not null default 12000,
  add column if not exists daily_token_budget integer,
  add column if not exists tokens_spent_today integer not null default 0,
  add column if not exists tokens_today_date date;

comment on column public.agents.working_hours_start is '0-23 local hour, inclusive; null = agent may run at any hour';
comment on column public.agents.working_hours_end is '0-24 local hour, exclusive; pair with working_hours_start';
comment on column public.agents.working_days is '0=Sunday .. 6=Saturday; null/empty = every day';
comment on column public.agents.daily_token_budget is 'null = unlimited; otherwise total tokens the agent may spend per day';
