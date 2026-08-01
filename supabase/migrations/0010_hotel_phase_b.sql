-- =============================================================================
-- Migration 0010 — Hotel Ops Phase B (menu/orders, tax config, collections link)
--
-- Room orders (food/water/consumables) on the folio; configurable VAT/tax
-- (global default + per-room override, snapshotted on each stay); hotel
-- payments also flow into collections (adds 'maya').
--
-- Idempotent.
-- =============================================================================

create table if not exists public.hotel_menu_items (
  id         uuid primary key default gen_random_uuid(),
  category   text not null default 'Food',
  name       text not null,
  price      numeric(12, 2) not null default 0,
  sort_order integer not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, name)
);
drop trigger if exists trg_hotel_menu_items_updated_at on public.hotel_menu_items;
create trigger trg_hotel_menu_items_updated_at before update on public.hotel_menu_items
  for each row execute function public.set_updated_at();

create table if not exists public.stay_orders (
  id           uuid primary key default gen_random_uuid(),
  stay_id      uuid not null references public.stays(id) on delete cascade,
  menu_item_id uuid references public.hotel_menu_items(id) on delete set null,
  name         text not null,
  qty          integer not null default 1 check (qty > 0),
  unit_price   numeric(12, 2) not null default 0,
  ordered_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
create index if not exists idx_stay_orders_stay on public.stay_orders(stay_id);

-- Global tax setting (singleton row id=1).
create table if not exists public.hotel_tax_settings (
  id        integer primary key default 1 check (id = 1),
  tax_mode  text not null default 'none' check (tax_mode in ('none', 'vat_inclusive', 'non_vat')),
  tax_rate  numeric(6, 4) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.hotel_tax_settings (id, tax_mode, tax_rate) values (1, 'none', 0)
  on conflict (id) do nothing;

-- Per-room tax override.
create table if not exists public.room_tax (
  unit_id    uuid primary key references public.units(id) on delete cascade,
  tax_mode   text not null check (tax_mode in ('none', 'vat_inclusive', 'non_vat')),
  tax_rate   numeric(6, 4) not null default 0,
  updated_at timestamptz not null default now()
);

-- Snapshot the effective tax onto each stay (reproducible receipts).
alter table public.stays add column if not exists tax_mode text not null default 'none';
alter table public.stays add column if not exists tax_rate numeric(6, 4) not null default 0;

-- Collections: accept Maya (used by hotel POS payments posted to collections).
alter table public.collections drop constraint if exists collections_payment_type_check;
alter table public.collections add constraint collections_payment_type_check
  check (payment_type in ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'check', 'other'));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.hotel_menu_items   enable row level security;
alter table public.stay_orders        enable row level security;
alter table public.hotel_tax_settings enable row level security;
alter table public.room_tax           enable row level security;

-- read helpers (hotel roles + oversight)
do $$
declare t text;
begin
  foreach t in array array['hotel_menu_items', 'stay_orders', 'hotel_tax_settings', 'room_tax'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %I_select on public.%I for select to authenticated
      using (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','room_attendant','operations_manager','managing_officer','admin']))$f$, t, t);
  end loop;
end $$;

-- menu: write = admin
drop policy if exists hotel_menu_items_write on public.hotel_menu_items;
create policy hotel_menu_items_write on public.hotel_menu_items for all to authenticated
  using (public.has_any_role(array['admin']))
  with check (public.has_any_role(array['admin']));

-- orders: write = hotel writers
drop policy if exists stay_orders_write on public.stay_orders;
create policy stay_orders_write on public.stay_orders for all to authenticated
  using (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','admin']))
  with check (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','admin']));

-- tax config: write = admin, accounting
drop policy if exists hotel_tax_settings_write on public.hotel_tax_settings;
create policy hotel_tax_settings_write on public.hotel_tax_settings for all to authenticated
  using (public.has_any_role(array['admin','accounting']))
  with check (public.has_any_role(array['admin','accounting']));
drop policy if exists room_tax_write on public.room_tax;
create policy room_tax_write on public.room_tax for all to authenticated
  using (public.has_any_role(array['admin','accounting']))
  with check (public.has_any_role(array['admin','accounting']));
