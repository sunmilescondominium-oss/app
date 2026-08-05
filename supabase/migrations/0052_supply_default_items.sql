-- 0052_supply_default_items.sql
-- Standard "room material" flag for housekeeping replacements.
-- Default items surface as tick-box checkboxes on the cleaning task; the rest
-- stay in a dropdown. Hotel & rental monitoring (and admin/operations) decide
-- which supplies are default.

alter table public.room_supplies
  add column if not exists is_default boolean not null default false;

-- Seed a sensible standard set. TODO(client-confirm): confirm the exact
-- default room materials with hotel & rental monitoring; they can edit these
-- from the Room supplies panel at any time.
update public.room_supplies
   set is_default = true
 where lower(name) similar to
       '%(towel|bath towel|hand towel|face towel|bath soap|soap|shampoo|toilet paper|tissue|water|bottled water|toothbrush|slipper|bed sheet|pillow case|pillowcase)%';
