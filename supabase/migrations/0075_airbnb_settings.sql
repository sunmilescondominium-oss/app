-- =============================================================================
-- Migration 0075 — AirBnB settings: rate plans, extras, tax, orders, requests
--
-- Rate plans support non-hourly periods (overnight, daily, weekly, monthly).
-- Extras cover food, parking, amenity add-ons ordered by guests or staff.
-- Orders can be placed from the guest QR portal or by staff.
-- Requests (cleaning/maintenance) auto-create housekeeping tasks or repair
-- tickets. Guests can cancel a pending cleaning request from their portal.
-- =============================================================================

-- ── Rate plans ────────────────────────────────────────────────────────────────

create table if not exists public.airbnb_rate_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  rate_type   text not null default 'nightly'
              check (rate_type in ('nightly','overnight','daily','2-night','3-night','weekly','monthly','custom')),
  rate        numeric(14,2) not null default 0,
  min_nights  int not null default 1,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now()
);

insert into public.airbnb_rate_plans (name, rate_type, rate, min_nights, sort_order) values
  ('Overnight',    'overnight', 0, 1, 10),
  ('Daily',        'daily',     0, 1, 20),
  ('Weekly',       'weekly',    0, 7, 30),
  ('Monthly',      'monthly',   0, 28, 40)
on conflict do nothing;

-- ── Extras menu ───────────────────────────────────────────────────────────────

create table if not exists public.airbnb_extras (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'Food'
              check (category in ('Food','Parking','Amenity','Laundry','Other')),
  unit_price  numeric(12,2) not null default 0,
  is_active   boolean not null default true,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now()
);

insert into public.airbnb_extras (name, category, unit_price, sort_order) values
  ('Additional Bed',    'Amenity', 0, 10),
  ('Additional Pillow', 'Amenity', 0, 20),
  ('Parking',           'Parking', 0, 30)
on conflict do nothing;

-- ── Tax settings (singleton) ──────────────────────────────────────────────────

create table if not exists public.airbnb_tax_settings (
  id       integer primary key default 1 check (id = 1),
  tax_mode text not null default 'none' check (tax_mode in ('none','vat','percentage')),
  tax_rate numeric(6,4) not null default 0
);
insert into public.airbnb_tax_settings default values on conflict do nothing;

-- ── Orders ────────────────────────────────────────────────────────────────────

create table if not exists public.airbnb_orders (
  id               uuid primary key default gen_random_uuid(),
  lease_id         uuid not null references public.leases(id) on delete cascade,
  placed_by        uuid references auth.users(id) on delete set null,
  placed_by_guest  boolean not null default false,
  status           text not null default 'pending'
                   check (status in ('pending','fulfilled','cancelled')),
  notes            text,
  total            numeric(14,2) not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_airbnb_orders_lease on public.airbnb_orders(lease_id, created_at desc);

create table if not exists public.airbnb_order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.airbnb_orders(id) on delete cascade,
  extra_id   uuid references public.airbnb_extras(id) on delete set null,
  name       text not null,
  qty        int not null default 1 check (qty > 0),
  unit_price numeric(12,2) not null default 0,
  subtotal   numeric(14,2) not null default 0
);
create index if not exists idx_airbnb_order_items on public.airbnb_order_items(order_id);

-- ── Requests (cleaning / maintenance) ────────────────────────────────────────

create table if not exists public.airbnb_requests (
  id                    uuid primary key default gen_random_uuid(),
  lease_id              uuid not null references public.leases(id) on delete cascade,
  request_type          text not null check (request_type in ('cleaning','maintenance')),
  notes                 text,
  status                text not null default 'pending'
                        check (status in ('pending','scheduled','cancelled','done')),
  placed_by_guest       boolean not null default false,
  placed_by             uuid references auth.users(id) on delete set null,
  scheduled_at          timestamptz,
  cancelled_at          timestamptz,
  cancelled_by_guest    boolean not null default false,
  housekeeping_task_id  uuid references public.housekeeping_tasks(id) on delete set null,
  repair_request_id     uuid references public.repair_requests(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index if not exists idx_airbnb_requests_lease on public.airbnb_requests(lease_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.airbnb_rate_plans  enable row level security;
alter table public.airbnb_extras      enable row level security;
alter table public.airbnb_tax_settings enable row level security;
alter table public.airbnb_orders      enable row level security;
alter table public.airbnb_order_items enable row level security;
alter table public.airbnb_requests    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'airbnb_rate_plans','airbnb_extras','airbnb_tax_settings',
    'airbnb_orders','airbnb_order_items','airbnb_requests'
  ] loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format(
      'create policy %I_sel on public.%I for select to authenticated using (public.has_any_role(array[''admin'',''managing_officer'',''accounting'',''hotel_rental_monitoring'',''consultant'']))',
      t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated using (public.has_any_role(array[''admin'',''managing_officer'',''hotel_rental_monitoring''])) with check (public.has_any_role(array[''admin'',''managing_officer'',''hotel_rental_monitoring'']))',
      t, t);
  end loop;
end $$;
