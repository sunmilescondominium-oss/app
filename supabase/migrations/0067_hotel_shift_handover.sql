-- =============================================================================
-- Migration 0067 — Hotel shift handovers
--
-- Cashier turns over their collection bag at end of shift to Hotel & Rental
-- Monitoring. The handover is lightweight: a timestamp, an optional cash count
-- (cashier may or may not have counted), and a remarks field.
--
-- Monitoring ALWAYS does the authoritative count. They then build the hotel
-- shift transmittal from this screen, which enters the custody chain at
-- monitoring_recount (since monitoring has already performed the count).
--
-- If the cashier was absent, monitoring marks cashier_absent = true and
-- proceeds directly.
-- =============================================================================

create table if not exists public.hotel_shift_handovers (
  id                  uuid primary key default gen_random_uuid(),
  shift_date          date not null,
  cashier_user_id     uuid references auth.users(id) on delete set null,
  cashier_role        text not null default 'hotel_cashier',
  counted_amount      numeric(14, 2),          -- null = cashier did not count
  denomination_counts jsonb,                   -- optional denomination breakdown from cashier
  remarks             text,
  cashier_absent      boolean not null default false,
  handed_over_at      timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (shift_date)                          -- one handover record per operation day
);

-- Link transmittals built from a hotel shift handover back to the handover
alter table public.transmittals
  add column if not exists handover_id uuid references public.hotel_shift_handovers(id) on delete set null;

-- Mark a transmittal as a hotel-shift type so the list page can filter it
alter table public.transmittals
  add column if not exists is_hotel_shift boolean not null default false;

-- RLS: hotel_cashier can insert/select their own; monitoring/accounting can see all
alter table public.hotel_shift_handovers enable row level security;

drop policy if exists handovers_select on public.hotel_shift_handovers;
create policy handovers_select on public.hotel_shift_handovers for select to authenticated
  using (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin',
    'managing_officer', 'accounting', 'consultant']));

drop policy if exists handovers_insert on public.hotel_shift_handovers;
create policy handovers_insert on public.hotel_shift_handovers for insert to authenticated
  with check (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin', 'managing_officer']));

create index if not exists idx_handovers_shift_date on public.hotel_shift_handovers(shift_date desc);
