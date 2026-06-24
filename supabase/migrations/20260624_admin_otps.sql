-- Admin OTP codes table. We generate 6-digit codes on our backend so the
-- length is always exactly 6, independent of Supabase's OTP length setting.
create table if not exists admin_otps (
  email       text        primary key,
  code        text        not null,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

-- Only service role can read/write this table (no public access).
alter table admin_otps enable row level security;
