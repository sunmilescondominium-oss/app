-- =============================================================================
-- Migration 0025 — Transmittal reconciliation + passbook tracking
--
--   • deposited_amount        — the amount the depositor actually banked, shown
--                               against the collected total for reconciliation.
--   • passbook_returned_on    — when the bank passbook was handed back to
--   • passbook_returned_by_role  accounting after the deposit (recorded by them).
-- =============================================================================

alter table public.transmittals add column if not exists deposited_amount        numeric(14, 2);
alter table public.transmittals add column if not exists passbook_returned_on     date;
alter table public.transmittals add column if not exists passbook_returned_by_role text;
