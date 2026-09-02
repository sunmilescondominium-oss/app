-- Migration 0104: checkout shortfall tracking on stays
alter table stays
  add column if not exists shortfall_amount  numeric,
  add column if not exists shortfall_reason  text,
  add column if not exists shortfall_forced_at  timestamptz,
  add column if not exists shortfall_forced_by  uuid references auth.users(id) on delete set null;
