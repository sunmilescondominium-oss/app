-- =============================================================================
-- Migration 0004 — Collections + Digital Cash Transmittal (M2)
--
-- Digital trail: every collection carries OR#, amount, category, collected-by
-- ROLE, date, and who entered it. Transmittals aggregate a day's collections
-- and move through submitted → deposited → reconciled, with a printable form
-- (paper trail) for physical signatures.
--
-- Idempotent.
-- =============================================================================

-- transmittals first (collections references it).
create table if not exists public.transmittals (
  id                 uuid primary key default gen_random_uuid(),
  business_line      text,                        -- null = combined daily transmittal
  transmittal_date   date not null default current_date,
  total_amount       numeric(14, 2) not null default 0,
  counted_by_role    text references public.roles(role_key),
  confirmed_by_role  text references public.roles(role_key),   -- bank deposit (errand_liaison)
  reconciled_by_role text references public.roles(role_key),   -- slip reconcile (accounting)
  deposit_slip_ref   text,
  status             text not null default 'submitted'
                     check (status in ('draft', 'submitted', 'deposited', 'reconciled')),
  notes              text,
  printed_at         timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_transmittals_date on public.transmittals(transmittal_date desc);

drop trigger if exists trg_transmittals_updated_at on public.transmittals;
create trigger trg_transmittals_updated_at
  before update on public.transmittals
  for each row execute function public.set_updated_at();

-- collections
create table if not exists public.collections (
  id             uuid primary key default gen_random_uuid(),
  business_line  text not null
                 check (business_line in ('condo_sales', 'rental', 'hotel',
                                          'airbnb', 'parking', 'utility', 'other')),
  unit_id        uuid references public.units(id) on delete set null,
  amount         numeric(14, 2) not null check (amount >= 0),
  or_number      text,
  payment_type   text not null default 'cash'
                 check (payment_type in ('cash', 'gcash', 'card', 'bank_transfer', 'check', 'other')),
  collected_by_role text references public.roles(role_key),
  collected_on   date not null default current_date,
  transmittal_id uuid references public.transmittals(id) on delete set null,
  remarks        text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_collections_date on public.collections(collected_on desc);
create index if not exists idx_collections_transmittal on public.collections(transmittal_id);

drop trigger if exists trg_collections_updated_at on public.collections;
create trigger trg_collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — mirrors lib/rbac/modules.ts (collections + transmittals).
-- ---------------------------------------------------------------------------
alter table public.collections  enable row level security;
alter table public.transmittals enable row level security;

-- collections: read = dashboard readers · write = entry roles
drop policy if exists collections_select on public.collections;
create policy collections_select
  on public.collections for select to authenticated
  using (public.has_any_role(array['managing_officer', 'consultant', 'accounting', 'hotel_rental_monitoring']));

drop policy if exists collections_write on public.collections;
create policy collections_write
  on public.collections for all to authenticated
  using (public.has_any_role(array['hotel_rental_monitoring', 'accounting']))
  with check (public.has_any_role(array['hotel_rental_monitoring', 'accounting']));

-- transmittals: read + write include errand_liaison (deposit) and managing_officer
drop policy if exists transmittals_select on public.transmittals;
create policy transmittals_select
  on public.transmittals for select to authenticated
  using (public.has_any_role(array['accounting', 'errand_liaison', 'hotel_rental_monitoring', 'managing_officer']));

drop policy if exists transmittals_write on public.transmittals;
create policy transmittals_write
  on public.transmittals for all to authenticated
  using (public.has_any_role(array['hotel_rental_monitoring', 'accounting', 'errand_liaison', 'managing_officer']))
  with check (public.has_any_role(array['hotel_rental_monitoring', 'accounting', 'errand_liaison', 'managing_officer']));
