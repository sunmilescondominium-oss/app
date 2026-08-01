-- =============================================================================
-- Seed 0008 — room-supplies inventory (starting stock). Idempotent by name;
-- re-seeding refreshes labels/reorder levels but never overwrites stock_qty.
-- =============================================================================

insert into public.room_supplies (name, unit_label, stock_qty, reorder_level, sort_order) values
  ('Bath Towel',          'pcs',  100, 20, 10),
  ('Pillow',              'pcs',  60,  10, 20),
  ('Pillow Case',         'pcs',  120, 20, 30),
  ('Bed Sheet',           'pcs',  80,  15, 40),
  ('Blanket',             'pcs',  50,  10, 50),
  ('Bottled Water 500ml', 'pcs',  200, 40, 60),
  ('Toiletry Kit',        'pcs',  150, 30, 70),
  ('Toilet Paper',        'roll', 180, 40, 80)
on conflict (name) do update set
  unit_label    = excluded.unit_label,
  reorder_level = excluded.reorder_level,
  sort_order    = excluded.sort_order;
