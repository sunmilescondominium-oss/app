-- =============================================================================
-- Migration 0051 — Booklet issuance (to whom / for what business) + reprint.
--
-- Beyond the custodian, a booklet is issued to a role/station for use in a
-- specific business line (e.g. AR → Hotel Cashier for Hotel; AR → Rental & Hotel
-- Collection for Rentals). When serials run low, a reprint can be requested.
-- =============================================================================

alter table public.form_booklets add column if not exists business_line       text;
alter table public.form_booklets add column if not exists issued_to_role       text;   -- role it's issued to for use
alter table public.form_booklets add column if not exists issued_to_label      text;   -- station / free label
alter table public.form_booklets add column if not exists reprint_requested_at timestamptz;
alter table public.form_booklets add column if not exists reprint_requested_by uuid references auth.users(id) on delete set null;
alter table public.form_booklets add column if not exists reprint_note         text;
