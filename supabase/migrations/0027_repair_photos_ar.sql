-- =============================================================================
-- Migration 0027 — Repair before/after photos + hotel acknowledgement receipt
--
--   • repair_requests: before/after photos taken by the technician.
--   • stay_payments.ar_no: an internal serialized Acknowledgement Receipt number
--     issued alongside the official receipt (OR), from a dedicated sequence.
-- =============================================================================

alter table public.repair_requests add column if not exists before_photo_path text;
alter table public.repair_requests add column if not exists after_photo_path  text;

create sequence if not exists public.hotel_ar_seq;
alter table public.stay_payments add column if not exists ar_no text;

-- Next serialized acknowledgement receipt number, e.g. AR-000123.
create or replace function public.next_hotel_ar() returns text language sql as $$
  select 'AR-' || lpad(nextval('public.hotel_ar_seq')::text, 6, '0')
$$;
