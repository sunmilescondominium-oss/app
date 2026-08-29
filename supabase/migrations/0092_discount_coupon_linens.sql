-- =============================================================================
-- Migration 0092 — Discount split, coupon-gated promos, linen supplies
-- =============================================================================

-- 1. Split promo discount from govt discount in hotel stays
--    promo_discount_amount is frozen at check-in and never touched on extension;
--    discount_amount = promo_discount + govt_discount recalculated on each extension.
alter table public.hotel_stays
  add column if not exists promo_discount_amount numeric(12,2) not null default 0,
  add column if not exists promo_coupon_no       text;

-- 2. Coupon-gated promos
alter table public.promos
  add column if not exists requires_coupon bool not null default false,
  add column if not exists coupons_total   int;  -- null = unlimited

-- 3. Guard entrance log: record discount coupon if guest volunteers one
alter table public.guard_entrance_log
  add column if not exists discount_coupon_no text;

-- 4. Room supplies: is_default flag + seed the 4 linen items
alter table public.room_supplies
  add column if not exists is_default bool not null default false;

insert into public.room_supplies (name, unit_label, stock_qty, reorder_level, sort_order, is_active, is_default)
values
  ('Pillow Cases', 'pcs', 0, 10, 10, true, true),
  ('Bedsheets',    'pcs', 0, 10, 20, true, true),
  ('Blankets',     'pcs', 0,  5, 30, true, true),
  ('Bath Towels',  'pcs', 0, 10, 40, true, true)
on conflict (name) do update
  set is_default = true,
      sort_order  = excluded.sort_order;
