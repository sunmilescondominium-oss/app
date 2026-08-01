-- =============================================================================
-- Migration 0014 — Philippine payroll basis (daily rate + schedule)
--
-- Replaces the naive "hours × hourly_rate" model with the PH daily-rate method:
--   • pay is anchored on a DAILY rate; hourly = daily_rate / standard_hours
--   • tardiness (late) and undertime are deducted proportionally
--   • overtime on an ordinary day = ot_multiplier (125%) of the hourly rate
--   • night differential = night_diff_rate (10%) for hours in the night window
--   • undertime is NOT offset by overtime (Labor Code Art. 88) — separate lines
--   • daily-paid = "no work, no pay" (absent days simply have no record)
--
-- All policy knobs live in payroll_settings so they are DB-row-driven and
-- adjustable without a deploy. Defaults are TODO(client-confirm).
-- Idempotent.
-- =============================================================================

-- Daily rate becomes the source of truth; migrate any legacy hourly figure.
alter table public.staff_pay add column if not exists daily_rate numeric(12, 2) not null default 0;
update public.staff_pay
   set daily_rate = round(hourly_rate * 8, 2)
 where daily_rate = 0 and hourly_rate > 0;

create table if not exists public.payroll_settings (
  id                int primary key default 1,
  scheduled_time_in time          not null default '09:00',
  standard_hours    numeric(4, 2) not null default 8,   -- net working hours / day
  break_hours       numeric(4, 2) not null default 1,   -- unpaid meal break
  grace_minutes     int           not null default 0,   -- tardiness grace
  ot_multiplier     numeric(4, 2) not null default 1.25,-- ordinary-day OT
  night_diff_rate   numeric(4, 3) not null default 0.10,-- 10PM–6AM premium
  night_start       time          not null default '22:00',
  night_end         time          not null default '06:00',
  half_day_hours    numeric(4, 2) not null default 4,   -- <= this ⇒ "half day"
  updated_at        timestamptz   not null default now(),
  constraint payroll_settings_singleton check (id = 1)
);
insert into public.payroll_settings (id) values (1) on conflict (id) do nothing;

alter table public.payroll_settings enable row level security;

drop policy if exists payroll_settings_select on public.payroll_settings;
create policy payroll_settings_select on public.payroll_settings for select to authenticated
  using (public.has_any_role(array['warehouse_timekeeper', 'accounting', 'admin', 'managing_officer']));

drop policy if exists payroll_settings_write on public.payroll_settings;
create policy payroll_settings_write on public.payroll_settings for all to authenticated
  using (public.has_any_role(array['admin', 'accounting']))
  with check (public.has_any_role(array['admin', 'accounting']));
