-- Business brief for a project. This is the "what the business does and wants"
-- context that every agent in the workspace reads, so each agent (engineer, QA,
-- design, ops, research…) understands the business it's building for and can
-- operate autonomously toward it.
alter table projects add column if not exists brief text;
