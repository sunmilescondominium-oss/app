-- =============================================================================
-- Migration 0036 — Transmittal chain of custody
--
-- Cash moves through several hands and is counted at each hop:
--   1. cashier_count      hotel/rental cashier counts & submits the transmittal
--   2. monitoring_recount hotel/rental monitoring recounts, records & transmits
--   3. passbook_issued    accounting issues the bank passbook for deposit
--   4. liaison_count      errand/liaison counts & prepares the deposit slip
--   5. deposited          errand/liaison deposits to the bank account
--
-- Every hop is signed BY ROLE and timestamped, with the amount counted at that
-- hop and the variance vs the reported total. Role-based only — no names.
-- =============================================================================

alter table public.transmittals
  add column if not exists custody_stage text not null default 'cashier_count';

create table if not exists public.transmittal_custody (
  id               uuid primary key default gen_random_uuid(),
  transmittal_id   uuid not null references public.transmittals(id) on delete cascade,
  stage            text not null
                   check (stage in ('cashier_count', 'monitoring_recount', 'passbook_issued', 'liaison_count', 'deposited')),
  actor_user_id    uuid references auth.users(id) on delete set null,
  actor_role       text,
  counted_amount   numeric(14, 2),
  expected_amount  numeric(14, 2),
  variance         numeric(14, 2),
  passbook_ref     text,
  deposit_slip_ref text,
  bank_account_id  uuid references public.bank_accounts(id) on delete set null,
  note             text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_custody_transmittal on public.transmittal_custody(transmittal_id, created_at);

alter table public.transmittal_custody enable row level security;
drop policy if exists custody_select on public.transmittal_custody;
create policy custody_select on public.transmittal_custody for select to authenticated
  using (public.has_any_role(array[
    'admin', 'managing_officer', 'operations_manager', 'accounting',
    'hotel_cashier', 'hotel_rental_monitoring', 'errand_liaison', 'consultant', 'owner']));
-- Writes go through the service role after the action validates the actor's role
-- for the current stage, so no write policy is defined here.
