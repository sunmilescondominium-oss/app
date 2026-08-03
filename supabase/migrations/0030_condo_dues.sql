-- =============================================================================
-- Migration 0030 — Condo association dues (per sqm) + common-area fund
--
-- Association dues = unit area (sqm) × rate. Rate is set per property with an
-- optional per-unit override, falling back to a default. Condo collections are
-- deposited to a SEPARATE common-area bank account (recorded in settings).
-- Condo dues/utilities reuse rental_dues + meter_readings (unit-keyed).
-- =============================================================================

create table if not exists public.condo_settings (
  id                  int primary key default 1,
  default_rate_per_sqm numeric(12, 2) not null default 0,
  bank_account        text,                     -- common-area fund account
  due_day             int not null default 15,  -- day of month dues fall due
  updated_at          timestamptz not null default now(),
  constraint condo_settings_singleton check (id = 1)
);
insert into public.condo_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.condo_property_rates (
  property_id  uuid primary key references public.properties(id) on delete cascade,
  rate_per_sqm numeric(12, 2) not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.units add column if not exists dues_rate_override numeric(12, 2);

alter table public.condo_settings       enable row level security;
alter table public.condo_property_rates enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['condo_settings', 'condo_property_rates'] loop
    execute format('drop policy if exists %I_all on public.%I', tbl, tbl);
    execute format(
      'create policy %I_all on public.%I for all to authenticated using (public.has_any_role(array[''admin'',''managing_officer'',''operations_manager'',''accounting'',''hotel_rental_monitoring''])) with check (public.has_any_role(array[''admin'',''managing_officer'',''operations_manager'',''accounting'',''hotel_rental_monitoring'']))',
      tbl, tbl);
  end loop;
end $$;
