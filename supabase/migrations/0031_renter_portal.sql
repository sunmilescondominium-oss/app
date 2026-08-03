-- =============================================================================
-- Migration 0031 — Renter self-service portal PIN
-- Renters view their own bills/payments on a public portal with unit# + PIN.
-- =============================================================================

alter table public.leases add column if not exists portal_pin text;
