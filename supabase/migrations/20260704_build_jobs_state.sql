-- Loop state for chained build steps. Each serverless invocation runs ONE
-- pass of the agentic loop and hands off to the next via this state — so a
-- long build is a chain of short function runs instead of one doomed long one.

alter table public.build_jobs
  add column if not exists state jsonb not null default '{}'::jsonb;
