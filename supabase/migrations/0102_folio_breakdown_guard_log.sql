-- =============================================================================
-- Migration 0102 — Folio breakdown JSONB + Guard log enhancements
--
-- 1. stay_payments.breakdown — itemized snapshot of what a payment covers
-- 2. guard_entrance_log — visitor_name, destination_unit, id_photo_url,
--    signature_url (ID photo + digital signature — future tablet feature)
-- 3. entry_type CHECK extended: unit_owner, renter, other
-- =============================================================================

-- ---------------------------------------------------------------------------
-- stay_payments — breakdown snapshot
-- ---------------------------------------------------------------------------
alter table public.stay_payments
  add column if not exists breakdown jsonb;

comment on column public.stay_payments.breakdown is
  'Itemized line-item snapshot at payment time: {lines:[{label,qty?,unit_price?,amount}], subtotal, discount, total}';

-- ---------------------------------------------------------------------------
-- guard_entrance_log — person name + destination + future biometric stubs
-- ---------------------------------------------------------------------------
alter table public.guard_entrance_log
  add column if not exists visitor_name       text,
  add column if not exists destination_unit   text,
  add column if not exists id_photo_url       text,   -- future: photo of presented ID
  add column if not exists signature_url      text;   -- future: guest digital signature on tablet

-- Extend entry_type to include unit owners, renters, and catch-all 'other'
alter table public.guard_entrance_log
  drop constraint if exists guard_entrance_log_entry_type_check;

alter table public.guard_entrance_log
  add constraint guard_entrance_log_entry_type_check
  check (entry_type in (
    'guest', 'vehicle', 'visitor', 'delivery', 'staff',
    'unit_owner', 'renter', 'other'
  ));
