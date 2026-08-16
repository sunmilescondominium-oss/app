-- Collection item type catalog — managed by accounting, replaces hardcoded BILLING_ITEM_TYPES.
-- key: stable slug stored as charge_type in collections; never changes after creation.
-- label: human-readable, editable.
-- grp: grouping for display (hotel, rental, condo_sales, airbnb, parking, utility, other).
-- is_active: soft-delete; inactive items are hidden from new entry but preserved on old records.

create table if not exists collection_item_types (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  grp         text not null default 'other',
  sort_order  int  not null default 100,
  is_active   boolean not null default true,
  is_system   boolean not null default false,  -- true = seeded from code; label editable but key/grp locked
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed from existing BILLING_ITEM_TYPES + COLLECTION_CHARGE_TYPES (deduped by key)
insert into collection_item_types (key, label, grp, sort_order, is_system) values
  -- Rental / Airbnb
  ('rent',            'Monthly Rent',             'rental',      10, true),
  ('electric',        'Electricity (Meralco)',     'utility',     20, true),
  ('water',           'Water',                    'utility',     30, true),
  ('association_dues','Association Dues',          'rental',      40, true),
  ('parking',         'Parking Fee',              'parking',     50, true),
  ('key_deposit',     'Key / Card Deposit',       'rental',      60, true),
  -- Condo Sales
  ('amortization',    'Monthly Amortization',     'condo_sales', 70, true),
  ('downpayment',     'Down Payment',             'condo_sales', 80, true),
  ('reservation',     'Reservation Fee',          'condo_sales', 90, true),
  ('processing_fee',  'Processing / Admin Fee',   'condo_sales',100, true),
  ('transfer_fee',    'Transfer / Documentary',   'condo_sales',110, true),
  -- Hotel
  ('room_charge',     'Room Charge',              'hotel',       120, true),
  ('food_orders',     'Food & Beverage Orders',   'hotel',       130, true),
  ('extra_services',  'Extra Services',           'hotel',       140, true),
  -- All / misc
  ('repairs',         'Repairs Charge',           'other',       150, true),
  ('miscellaneous',   'Miscellaneous / Other',    'other',       160, true),
  -- Airbnb-specific (from COLLECTION_CHARGE_TYPES, not in BILLING_ITEM_TYPES)
  ('dues',            'Condo / Association Dues', 'rental',       45, true)
on conflict (key) do nothing;

-- RLS
alter table collection_item_types enable row level security;

-- All authenticated users can read active items
create policy "authenticated read collection_item_types"
  on collection_item_types for select
  to authenticated
  using (true);

-- Accounting, admin, managing_officer can insert/update
create policy "accounting write collection_item_types"
  on collection_item_types for insert
  to authenticated
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key in ('accounting','admin','managing_officer','consultant')
    )
  );

create policy "accounting update collection_item_types"
  on collection_item_types for update
  to authenticated
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key in ('accounting','admin','managing_officer','consultant')
    )
  );
