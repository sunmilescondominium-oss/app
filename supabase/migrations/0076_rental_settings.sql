-- =============================================================================
-- Migration 0076 — Rental settings: tax config + utility rates
--
-- rental_tax_settings: singleton row (id=1) for VAT/percentage on rental
--   collections.
-- utility_rates: electric and water rate per unit (kWh/m³) with effective_from
--   so historical rates are preserved. The most recent row per utility is used
--   to compute the bill from meter reading consumption.
-- =============================================================================

-- ── Rental tax settings (singleton) ──────────────────────────────────────────

create table if not exists public.rental_tax_settings (
  id       integer primary key default 1 check (id = 1),
  tax_mode text not null default 'none' check (tax_mode in ('none','vat','percentage')),
  tax_rate numeric(6,4) not null default 0
);
insert into public.rental_tax_settings default values on conflict do nothing;

-- ── Utility rates ─────────────────────────────────────────────────────────────

create table if not exists public.utility_rates (
  id              uuid primary key default gen_random_uuid(),
  utility         text not null check (utility in ('electric','water')),
  rate_per_unit   numeric(10,4) not null default 0,  -- per kWh or per m³
  service_charge  numeric(10,2) not null default 0,  -- fixed monthly service charge
  effective_from  date not null default current_date,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_utility_rates_eff on public.utility_rates(utility, effective_from desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.rental_tax_settings enable row level security;
alter table public.utility_rates        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rental_tax_settings','utility_rates'] loop
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
