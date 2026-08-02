-- =============================================================================
-- Migration 0016 — Shift scheduling, public attendance kiosk, Official Business
--
--   • profiles.employee_no + passcode_hash — credentials for the PUBLIC kiosk
--     (employees clock in without a PMS login: ID number + passcode + photo).
--   • time_records.ip_address / source — where a kiosk punch came from.
--   • leave_requests.category ('leave'|'ob') + duration ('whole_day'|'half_day')
--     — Official Business reuses the leave approval workflow.
--   • shift_schedules — per-employee, per-day scheduled shift (drives "absent"
--     detection and date-accurate leave-coverage checks).
--
-- Idempotent.
-- =============================================================================

alter table public.profiles add column if not exists employee_no    text;
alter table public.profiles add column if not exists passcode_hash  text;
create unique index if not exists idx_profiles_employee_no on public.profiles(employee_no) where employee_no is not null;

alter table public.time_records add column if not exists ip_address text;
alter table public.time_records add column if not exists source     text not null default 'app';

alter table public.leave_requests add column if not exists category text not null default 'leave'
  check (category in ('leave', 'ob'));
alter table public.leave_requests add column if not exists duration text
  check (duration in ('whole_day', 'half_day'));

create table if not exists public.shift_schedules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  work_date  date not null,
  start_time time,
  end_time   time,
  note       text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);
create index if not exists idx_shift_date on public.shift_schedules(work_date);

drop trigger if exists trg_shift_updated_at on public.shift_schedules;
create trigger trg_shift_updated_at before update on public.shift_schedules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — schedulers manage shifts; employees see their own.
-- ---------------------------------------------------------------------------
alter table public.shift_schedules enable row level security;

drop policy if exists shift_select on public.shift_schedules;
create policy shift_select on public.shift_schedules for select to authenticated
  using (user_id = auth.uid()
         or public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'warehouse_timekeeper']));

drop policy if exists shift_write on public.shift_schedules;
create policy shift_write on public.shift_schedules for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'warehouse_timekeeper']))
  with check (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'warehouse_timekeeper']));
