-- =============================================================================
-- Migration 0096 — Guard operation type
--
-- Guards are agency staff with two operational areas:
--   hotel  — Hotel entrance gate ops
--   condo  — Condo/rental area ops
-- More types can be added by extending the check constraint in a future migration.
-- =============================================================================

alter table public.profiles
  add column if not exists guard_operation text
  check (guard_operation in ('hotel', 'condo'));
