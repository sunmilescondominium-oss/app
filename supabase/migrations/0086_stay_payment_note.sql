-- Migration 0086 — payment_note on stay_payments
-- Allows labelling upgrade fee payments and other annotated collections
-- so the folio/receipt can show "Upgrade fee from Room 101" etc.

alter table public.stay_payments
  add column if not exists payment_note text;
