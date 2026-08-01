-- =============================================================================
-- Seed 0006 — default hotel rate plans (short-stay). Editable by admin, no
-- deploy. Idempotent (on name). TODO(client-confirm): confirm real rates.
-- =============================================================================

insert into public.rate_plans (name, base_hours, base_rate, extra_hour_rate, sort_order) values
  ('Short Stay 3 Hours', 3,  500.00, 150.00, 10),
  ('6 Hours',            6,  900.00, 150.00, 20),
  ('12 Hours',           12, 1500.00, 120.00, 30),
  ('Overnight 22 Hours', 22, 2200.00, 100.00, 40)
on conflict (name) do update set
  base_hours      = excluded.base_hours,
  base_rate       = excluded.base_rate,
  extra_hour_rate = excluded.extra_hour_rate,
  sort_order      = excluded.sort_order;
