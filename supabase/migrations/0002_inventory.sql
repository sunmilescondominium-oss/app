-- =============================================================================
-- Migration 0002 — Inventory (M1)
--
-- Unified property & unit/room registry for ALL business lines
-- (condo_sales | rental | hotel | airbnb). Recategorizing a unit between lines
-- is a single column update — never a code change or deploy.
--
-- Idempotent (safe to re-run).
-- =============================================================================

-- is_staff(): true when the current user holds any active staff role.
-- SECURITY DEFINER so it reads user_roles/roles without recursing into RLS.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.role_key = ur.role_key
    where ur.user_id = auth.uid()
      and r.is_staff = true
      and r.is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_properties_updated_at on public.properties;
create trigger trg_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- units (also covers hotel rooms and airbnb-pool units)
-- ---------------------------------------------------------------------------
create table if not exists public.units (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete restrict,
  unit_number   text not null,
  unit_type     text,
  floor         text,
  area_sqm      numeric(10, 2),
  amenities     jsonb not null default '{}'::jsonb,
  status        text not null default 'available'
                check (status in ('available', 'occupied', 'reserved',
                                  'under_maintenance', 'blocked')),
  business_line text not null
                check (business_line in ('condo_sales', 'rental', 'hotel', 'airbnb')),
  tcp           numeric(14, 2),                 -- total contract price (condo sales)
  is_active     boolean not null default true,  -- soft delete / deactivate
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (property_id, unit_number)
);

create index if not exists idx_units_property      on public.units(property_id);
create index if not exists idx_units_business_line on public.units(business_line);
create index if not exists idx_units_status        on public.units(status);

drop trigger if exists trg_units_updated_at on public.units;
create trigger trg_units_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — policies MIRROR lib/rbac/modules.ts (module "inventory").
-- read: all staff · write: admin, operations_manager, managing_officer
-- ---------------------------------------------------------------------------
alter table public.properties enable row level security;
alter table public.units      enable row level security;

drop policy if exists properties_select_staff on public.properties;
create policy properties_select_staff
  on public.properties for select to authenticated
  using (public.is_staff());

drop policy if exists units_select_staff on public.units;
create policy units_select_staff
  on public.units for select to authenticated
  using (public.is_staff());

-- Writers: for-all covers insert/update/delete; combined with the select
-- policy above via RLS's OR semantics, staff can still read.
drop policy if exists properties_write on public.properties;
create policy properties_write
  on public.properties for all to authenticated
  using (public.has_any_role(array['admin', 'operations_manager', 'managing_officer']))
  with check (public.has_any_role(array['admin', 'operations_manager', 'managing_officer']));

drop policy if exists units_write on public.units;
create policy units_write
  on public.units for all to authenticated
  using (public.has_any_role(array['admin', 'operations_manager', 'managing_officer']))
  with check (public.has_any_role(array['admin', 'operations_manager', 'managing_officer']));
