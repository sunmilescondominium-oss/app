-- =============================================================================
-- Seed 0007 — default hotel menu (food / beverage / consumables). Editable by
-- admin, no deploy. Idempotent. TODO(client-confirm): real menu + prices.
-- =============================================================================

insert into public.hotel_menu_items (category, name, price, sort_order) values
  ('Beverage',   'Bottled Water 500ml', 25.00,  10),
  ('Beverage',   'Softdrinks (can)',    45.00,  20),
  ('Beverage',   'Coffee',              35.00,  30),
  ('Food',       'Instant Noodles',     60.00,  40),
  ('Food',       'Silog Meal',          150.00, 50),
  ('Food',       'Fried Chicken Meal',  180.00, 60),
  ('Consumable', 'Extra Towel',         50.00,  70),
  ('Consumable', 'Toiletry Kit',        40.00,  80),
  ('Service',    'Extra Pillow',        30.00,  90)
on conflict (category, name) do update set
  price = excluded.price, sort_order = excluded.sort_order;
