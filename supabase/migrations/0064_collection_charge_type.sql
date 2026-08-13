-- Add charge_type to collections so room-linked entries carry a structured
-- description of what is being collected (rent, electric, water, dues, etc.).
-- NULL is valid for non-unit collections (e.g. standalone parking, walk-in hotel).
alter table public.collections
  add column if not exists charge_type text
  check (charge_type in (
    'rent', 'electric', 'water', 'dues',
    'parking', 'key_deposit', 'miscellaneous'
  ));
