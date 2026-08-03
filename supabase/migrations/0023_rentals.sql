-- =============================================================================
-- Migration 0023 — Rentals & Airbnb: occupancy, meter readings, dues
--
--   • leases           — who occupies a rental/airbnb unit (airbnb uses end_at
--                        as the checkout time; extendable).
--   • meter_readings   — electric / water readings per unit over time.
--   • rental_dues      — amounts due (rent, association dues, utilities) with a
--                        due date and paid/unpaid status → drives reminders.
-- Idempotent.
-- =============================================================================

create table if not exists public.leases (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units(id) on delete cascade,
  business_line text not null check (business_line in ('rental', 'airbnb')),
  tenant_label  text not null,
  contact       text,
  start_date    date not null default current_date,
  end_at        timestamptz,                    -- airbnb checkout / lease end
  rent_amount   numeric(14, 2) not null default 0,
  billing_cycle text not null default 'monthly',-- monthly | nightly
  deposit       numeric(14, 2) not null default 0,
  status        text not null default 'active' check (status in ('active', 'ended')),
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_leases_unit on public.leases(unit_id, status);

create table if not exists public.meter_readings (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references public.units(id) on delete cascade,
  utility    text not null check (utility in ('electric', 'water')),
  reading    numeric(12, 2) not null,
  read_on    date not null default current_date,
  remarks    text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_meter_unit on public.meter_readings(unit_id, utility, read_on desc);

create table if not exists public.rental_dues (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units(id) on delete cascade,
  lease_id      uuid references public.leases(id) on delete set null,
  category      text not null default 'rent',
  due_date      date not null,
  amount        numeric(14, 2) not null,
  status        text not null default 'unpaid' check (status in ('unpaid', 'paid', 'waived')),
  paid_on       date,
  collection_id uuid references public.collections(id) on delete set null,
  remarks       text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_dues_status on public.rental_dues(status, due_date);

drop trigger if exists trg_leases_updated_at on public.leases;
create trigger trg_leases_updated_at before update on public.leases for each row execute function public.set_updated_at();
drop trigger if exists trg_dues_updated_at on public.rental_dues;
create trigger trg_dues_updated_at before update on public.rental_dues for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — rental/monitoring/accounting roles manage all three.
-- ---------------------------------------------------------------------------
alter table public.leases         enable row level security;
alter table public.meter_readings enable row level security;
alter table public.rental_dues    enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['leases', 'meter_readings', 'rental_dues'] loop
    execute format('drop policy if exists %I_all on public.%I', tbl, tbl);
    execute format(
      'create policy %I_all on public.%I for all to authenticated using (public.has_any_role(array[''admin'',''managing_officer'',''operations_manager'',''accounting'',''hotel_rental_monitoring''])) with check (public.has_any_role(array[''admin'',''managing_officer'',''operations_manager'',''accounting'',''hotel_rental_monitoring'']))',
      tbl, tbl);
  end loop;
end $$;
