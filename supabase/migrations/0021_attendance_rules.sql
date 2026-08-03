-- =============================================================================
-- Migration 0021 — Employee name, tardiness rounding, auto check-out
--
--   • profiles.full_name — the employee's real name (shown on the 201 file and
--     the attendance board). Runtime data entered by HR — no names in code.
--   • payroll_settings.late_round_up_minutes — tardiness past this many minutes
--     within an hour is charged as a full hour (default 30).
--   • payroll_settings.auto_checkout_time — an open punch is auto-closed at this
--     time when there is no approved overtime (default 17:00).
--   • time_records.auto_checkout — flags a punch the system closed because the
--     employee never clocked out (recorded, and admin is alerted).
-- =============================================================================

alter table public.profiles add column if not exists full_name text;

alter table public.payroll_settings add column if not exists late_round_up_minutes int not null default 30;
alter table public.payroll_settings add column if not exists auto_checkout_time time not null default '17:00';

alter table public.time_records add column if not exists auto_checkout boolean not null default false;
