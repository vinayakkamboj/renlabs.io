-- token_hash column is no longer used (generateLink is called fresh at verify time).
alter table admin_otps drop column if exists token_hash;
