-- =============================================================================
-- Migration 0060 — Parking receipt series + transmittal payment mode
--
-- 1. Adds 'parking' to receipt_series (PF- prefix for Parking Fee ARs).
-- 2. Adds payment_mode, transmittal_source, transfer_proof_path, and
--    transfer_bank_account_id to transmittals so bank-transfer submissions
--    can be documented with proof and linked bank account.
-- =============================================================================

-- 1. Alter receipt_series check constraint to include 'parking'.
alter table public.receipt_series
  drop constraint if exists receipt_series_context_check;

alter table public.receipt_series
  add constraint receipt_series_context_check
  check (context in ('hotel', 'rental', 'parking'));

insert into public.receipt_series (context, prefix, next_no)
values ('parking', 'PF-', 1)
on conflict (context) do nothing;

-- 2. Transmittal enrichment columns.
alter table public.transmittals
  add column if not exists payment_mode         text not null default 'cash',
  add column if not exists transmittal_source   text,
  add column if not exists transfer_proof_path  text,
  add column if not exists transfer_bank_account_id uuid references public.bank_accounts(id);
