-- =============================================================================
-- Migration 0042 — Starter materials/tools/equipment catalog for Requisitions.
-- Idempotent: only inserts a name if it isn't already in the catalog. These are
-- common standard-hotel maintenance & warehouse items; edit/extend freely later.
-- =============================================================================

insert into public.material_items (name, category, unit_label, reorder_level, target, sort_order)
select v.name, v.category, v.unit_label, v.reorder_level, v.target, v.sort_order
from (values
  -- Cleaning consumables (received stock flows into housekeeping supplies)
  ('Bleach (Zonrox) 1 gal',      'consumable', 'gal',  4, 'room_supplies', 10),
  ('Dishwashing liquid 1 gal',   'consumable', 'gal',  3, 'room_supplies', 11),
  ('Toilet bowl cleaner',        'consumable', 'btl',  4, 'room_supplies', 12),
  ('Garbage bags (XL)',          'consumable', 'roll', 6, 'room_supplies', 13),
  ('Air freshener',              'consumable', 'can',  6, 'room_supplies', 14),
  ('Insect spray',               'consumable', 'can',  3, 'room_supplies', 15),
  -- Maintenance materials
  ('PVC pipe 1/2"',              'material',   'pc',   5, 'materials', 20),
  ('Electrical wire (THHN #12)', 'material',   'm',   20, 'materials', 21),
  ('Teflon tape',                'material',   'roll',10, 'materials', 22),
  ('LED bulb 9W',                'material',   'pc',  12, 'materials', 23),
  ('Faucet (lavatory)',          'material',   'pc',   2, 'materials', 24),
  ('Paint (latex, white) 1 gal', 'material',   'gal',  2, 'materials', 25),
  -- Tools
  ('Screwdriver set',            'tool',       'set',  1, 'materials', 30),
  ('Claw hammer',                'tool',       'pc',   1, 'materials', 31),
  ('Pliers',                     'tool',       'pc',   1, 'materials', 32),
  ('Adjustable wrench',          'tool',       'pc',   1, 'materials', 33),
  ('Electric drill',             'tool',       'pc',   1, 'materials', 34),
  ('Angle grinder',              'tool',       'pc',   1, 'materials', 35),
  -- Equipment
  ('Aluminum ladder (8ft)',      'equipment',  'pc',   1, 'materials', 40),
  ('Wet/dry vacuum',             'equipment',  'pc',   1, 'materials', 41),
  ('Water pump',                 'equipment',  'pc',   1, 'materials', 42)
) as v(name, category, unit_label, reorder_level, target, sort_order)
where not exists (
  select 1 from public.material_items m where lower(m.name) = lower(v.name)
);
