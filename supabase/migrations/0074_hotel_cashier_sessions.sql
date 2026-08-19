-- =============================================================================
-- Migration 0074 — Hotel cashier sessions
--
-- One cashier is "on duty" at a time. They open a session declaring their
-- beginning AR number, perform collections, then close the shift with the
-- ending AR number. The next cashier's beginning AR is implicitly the next
-- number after the previous ending AR.
--
-- Cancelled ARs (errors, voids) are logged per session with a required reason.
-- =============================================================================

create table if not exists public.hotel_cashier_sessions (
  id               uuid primary key default gen_random_uuid(),
  cashier_user_id  uuid not null references auth.users(id) on delete restrict,
  opened_at        timestamptz not null default now(),
  beginning_ar_no  text not null,        -- e.g. "AR-000123" declared by cashier
  ending_ar_no     text,                 -- null until shift closes
  closed_at        timestamptz,
  closed_by        uuid references auth.users(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now()
);

-- Enforce: at most one open (unclosed) session at a time
create unique index if not exists hotel_sessions_one_open
  on public.hotel_cashier_sessions ((true))
  where closed_at is null;

create index if not exists idx_hotel_sessions_cashier
  on public.hotel_cashier_sessions(cashier_user_id, opened_at desc);

create index if not exists idx_hotel_sessions_opened
  on public.hotel_cashier_sessions(opened_at desc);

-- Cancelled / voided AR numbers logged per session
create table if not exists public.hotel_ar_cancellations (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.hotel_cashier_sessions(id) on delete cascade,
  ar_no         text not null,
  reason        text not null,
  cancelled_by  uuid not null references auth.users(id) on delete restrict,
  cancelled_at  timestamptz not null default now()
);

create index if not exists idx_ar_cancels_session
  on public.hotel_ar_cancellations(session_id, cancelled_at desc);

-- RLS -------------------------------------------------------------------------

alter table public.hotel_cashier_sessions enable row level security;
alter table public.hotel_ar_cancellations  enable row level security;

-- Sessions: all hotel roles can read
drop policy if exists hotel_sessions_select on public.hotel_cashier_sessions;
create policy hotel_sessions_select on public.hotel_cashier_sessions
  for select to authenticated
  using (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin',
    'managing_officer', 'accounting', 'consultant']));

-- Open a session: cashier + supervisors
drop policy if exists hotel_sessions_insert on public.hotel_cashier_sessions;
create policy hotel_sessions_insert on public.hotel_cashier_sessions
  for insert to authenticated
  with check (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin', 'managing_officer']));

-- Close / update a session: cashier (own) + supervisors
drop policy if exists hotel_sessions_update on public.hotel_cashier_sessions;
create policy hotel_sessions_update on public.hotel_cashier_sessions
  for update to authenticated
  using (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin', 'managing_officer']))
  with check (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin', 'managing_officer']));

-- Cancellations: same read/write roles
drop policy if exists ar_cancels_select on public.hotel_ar_cancellations;
create policy ar_cancels_select on public.hotel_ar_cancellations
  for select to authenticated
  using (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin',
    'managing_officer', 'accounting', 'consultant']));

drop policy if exists ar_cancels_insert on public.hotel_ar_cancellations;
create policy ar_cancels_insert on public.hotel_ar_cancellations
  for insert to authenticated
  with check (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin', 'managing_officer']));
