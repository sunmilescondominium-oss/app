-- =============================================================================
-- Migration 0005 — Buyer Account + SOA (M3)
--
-- buyers (linked to a unit, portal PIN), versioned buyer_soa snapshots
-- (computed_json = reproducible artifact), payments (OR/PR/AR), and
-- computation_params (editable rates/terms — no deploy to change).
--
-- Idempotent.
-- =============================================================================

create table if not exists public.buyers (
  id                   uuid primary key default gen_random_uuid(),
  unit_id              uuid references public.units(id) on delete set null,
  contact_label        text not null default 'Buyer',   -- label, never a personal name
  ref_pin              text not null,                    -- public portal lookup
  payment_scheme       text not null default 'fixed'
                       check (payment_scheme in ('step_up', 'fixed', 'balloon')),
  payment_status       text not null default 'current'
                       check (payment_status in ('current', 'overdue', 'restructured', 'in_dispute')),
  tcp                  numeric(14, 2),                   -- falls back to unit.tcp
  downpayment          numeric(14, 2) not null default 0,
  term_months          integer not null default 60,
  annual_interest_rate numeric(6, 4),                    -- null = computation_params default
  start_date           date not null default current_date,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_buyers_unit on public.buyers(unit_id);

drop trigger if exists trg_buyers_updated_at on public.buyers;
create trigger trg_buyers_updated_at
  before update on public.buyers
  for each row execute function public.set_updated_at();

-- Versioned SOA snapshots — computed_json is the reproducible record.
create table if not exists public.buyer_soa (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid not null references public.buyers(id) on delete cascade,
  computed_json    jsonb not null,
  contract_balance numeric(14, 2),
  next_due_date    date,
  source           text not null default 'local' check (source in ('local', 'n8n')),
  params_version   integer,
  created_at       timestamptz not null default now()
);
create index if not exists idx_buyer_soa_buyer on public.buyer_soa(buyer_id, created_at desc);

create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  buyer_id   uuid not null references public.buyers(id) on delete cascade,
  doc_type   text not null default 'OR' check (doc_type in ('OR', 'PR', 'AR')),
  or_number  text,
  amount     numeric(14, 2) not null check (amount >= 0),
  paid_on    date not null default current_date,
  remarks    text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_buyer on public.payments(buyer_id, paid_on);

-- Editable computation parameters (rates / % / terms). No deploy to change.
create table if not exists public.computation_params (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  value          numeric not null,
  label          text,
  params_version integer not null default 1,
  is_active      boolean not null default true,
  effective_from date not null default current_date,
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_computation_params_updated_at on public.computation_params;
create trigger trg_computation_params_updated_at
  before update on public.computation_params
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — mirrors lib/rbac/modules.ts (module "buyers").
-- read = accounting, admin, consultant, managing_officer · write = accounting, admin
-- computation_params: read = all staff · write = admin, consultant
-- The PUBLIC portal reads via the service role in a server route (bypasses RLS).
-- ---------------------------------------------------------------------------
alter table public.buyers             enable row level security;
alter table public.buyer_soa          enable row level security;
alter table public.payments           enable row level security;
alter table public.computation_params enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['buyers', 'buyer_soa', 'payments'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %I_select on public.%I for select to authenticated
      using (public.has_any_role(array['accounting','admin','consultant','managing_officer']))$f$, t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($f$create policy %I_write on public.%I for all to authenticated
      using (public.has_any_role(array['accounting','admin']))
      with check (public.has_any_role(array['accounting','admin']))$f$, t, t);
  end loop;
end $$;

drop policy if exists computation_params_select on public.computation_params;
create policy computation_params_select
  on public.computation_params for select to authenticated
  using (public.is_staff());

drop policy if exists computation_params_write on public.computation_params;
create policy computation_params_write
  on public.computation_params for all to authenticated
  using (public.has_any_role(array['admin', 'consultant']))
  with check (public.has_any_role(array['admin', 'consultant']));
