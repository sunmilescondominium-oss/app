-- 0055_email_verification.sql
-- Track that a user actually received and acted on their access email: they set
-- their own password via the emailed link, which proves the email is theirs.
-- email_verified_at is stamped when that happens; invite_sent_at records the
-- last time an access/verification email was sent to them.

alter table public.profiles
  add column if not exists email_verified_at timestamptz,
  add column if not exists invite_sent_at    timestamptz;
