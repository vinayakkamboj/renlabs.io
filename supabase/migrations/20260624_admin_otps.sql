-- Admin OTP codes table for backend-controlled 6-digit sign-in codes.
-- We generate the code ourselves so the length is always exactly 6 digits,
-- independent of Supabase's global OTP length setting.
create table if not exists admin_otps (
  email       text        primary key,
  code        text        not null,
  token_hash  text        not null,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

-- Only service role can read/write this table (no public access).
alter table admin_otps enable row level security;
