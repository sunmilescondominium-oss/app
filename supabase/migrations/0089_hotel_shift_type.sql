-- =============================================================================
-- Migration 0089 — Hotel cashier shift type
--
-- Adds shift_type ('day' | 'night') to sessions and shift reports so
-- collections can be separated by shift for analysis.
--
-- Day shift  : 06:00 – 18:00 Manila (collection cutoff 17:40)
-- Night shift : 18:00 – 06:00 Manila (collection cutoff 05:40)
-- =============================================================================

alter table public.hotel_cashier_sessions
  add column if not exists shift_type text
    check (shift_type in ('day', 'night'));

alter table public.hotel_shift_reports
  add column if not exists shift_type text
    check (shift_type in ('day', 'night'));
