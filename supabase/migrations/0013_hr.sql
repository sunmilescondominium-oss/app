-- =============================================================================
-- Migration 0013 — HR / Attendance & Payroll (Module 8)
--
-- Photo-capture time-in/out (time_records), DTR from paired records, and a
-- payroll summary (hours × staff_pay.hourly_rate). Ties to the user account
-- (profiles/auth.users) + the user's chosen display label — never a hardcoded
-- name. Photos live in a PRIVATE bucket (created in the seed).
--
-- Idempotent.
-- =============================================================================

create table if not exists public.time_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  work_date      date not null default (now() at time zone 'Asia/Manila')::date,
  time_in        timestamptz,
  time_in_photo  text,
  time_out       timestamptz,
  time_out_photo text,
  hours          numeric(6, 2),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_time_records_user on public.time_records(user_id, work_date desc);
create index if not exists idx_time_records_open on public.time_records(user_id) where time_out is null;

drop trigger if exists trg_time_records_updated_at on public.time_records;
create trigger trg_time_records_updated_at before update on public.time_records
  for each row execute function public.set_updated_at();

create table if not exists public.staff_pay (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  hourly_rate numeric(12, 2) not null default 0,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS — a user sees/writes their OWN records; HR roles read all.
-- ---------------------------------------------------------------------------
alter table public.time_records enable row level security;
alter table public.staff_pay    enable row level security;

drop policy if exists time_records_select on public.time_records;
create policy time_records_select on public.time_records for select to authenticated
  using (user_id = auth.uid()
         or public.has_any_role(array['warehouse_timekeeper', 'accounting', 'admin', 'managing_officer']));

drop policy if exists time_records_write on public.time_records;
create policy time_records_write on public.time_records for all to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['admin']))
  with check (user_id = auth.uid() or public.has_any_role(array['admin']));

drop policy if exists staff_pay_select on public.staff_pay;
create policy staff_pay_select on public.staff_pay for select to authenticated
  using (user_id = auth.uid()
         or public.has_any_role(array['warehouse_timekeeper', 'accounting', 'admin', 'managing_officer']));

drop policy if exists staff_pay_write on public.staff_pay;
create policy staff_pay_write on public.staff_pay for all to authenticated
  using (public.has_any_role(array['admin', 'accounting']))
  with check (public.has_any_role(array['admin', 'accounting']));
