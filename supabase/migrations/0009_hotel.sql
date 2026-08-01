-- =============================================================================
-- Migration 0009 — Hotel Operations, Phase A (room board, stays, payments)
--
-- Short-stay hotel front desk: customizable rate plans (3-hr minimum + extra
-- hours) + promos, check-in/extend/check-out with live timers, payments
-- (cash/gcash/maya/bank) and printable receipts. Rooms come from
-- units(business_line='hotel'). Rate snapshot is stored on each stay so rate
-- changes never retro-affect an active stay.
--
-- Idempotent.
-- =============================================================================

create table if not exists public.rate_plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  base_hours      integer not null default 3,
  base_rate       numeric(12, 2) not null,
  extra_hour_rate numeric(12, 2) not null default 0,
  sort_order      integer not null default 100,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_rate_plans_updated_at on public.rate_plans;
create trigger trg_rate_plans_updated_at before update on public.rate_plans
  for each row execute function public.set_updated_at();

create table if not exists public.promos (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  disc_type  text not null default 'percent' check (disc_type in ('percent', 'amount')),
  disc_value numeric(12, 2) not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stays (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid references public.units(id) on delete restrict,
  guest_label     text not null default 'Guest',
  guest_contact   text,
  rate_plan_id    uuid references public.rate_plans(id),
  planned_hours   integer not null default 3,
  base_hours      integer not null default 3,
  base_rate       numeric(12, 2) not null default 0,
  extra_hour_rate numeric(12, 2) not null default 0,
  promo_id        uuid references public.promos(id),
  discount_amount numeric(12, 2) not null default 0,
  check_in_at     timestamptz not null default now(),
  check_out_at    timestamptz,
  status          text not null default 'active' check (status in ('active', 'checked_out')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_stays_status on public.stays(status);
create index if not exists idx_stays_unit on public.stays(unit_id);
drop trigger if exists trg_stays_updated_at on public.stays;
create trigger trg_stays_updated_at before update on public.stays
  for each row execute function public.set_updated_at();
-- for envs where stays already existed without base_hours:
alter table public.stays add column if not exists base_hours integer not null default 3;

create table if not exists public.stay_extensions (
  id          uuid primary key default gen_random_uuid(),
  stay_id     uuid not null references public.stays(id) on delete cascade,
  added_hours integer not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.stay_payments (
  id         uuid primary key default gen_random_uuid(),
  stay_id    uuid not null references public.stays(id) on delete cascade,
  method     text not null check (method in ('cash', 'gcash', 'maya', 'bank_transfer')),
  amount     numeric(12, 2) not null check (amount >= 0),
  receipt_no text,
  paid_at    timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_stay_payments_stay on public.stay_payments(stay_id);

-- ---------------------------------------------------------------------------
-- RLS — read = hotel roles + oversight · write = cashier/monitoring/admin
-- rate_plans/promos: read = hotel readers · write = admin (config)
-- ---------------------------------------------------------------------------
alter table public.rate_plans      enable row level security;
alter table public.promos          enable row level security;
alter table public.stays           enable row level security;
alter table public.stay_extensions enable row level security;
alter table public.stay_payments   enable row level security;

do $$
declare t text;
begin
  -- config tables: read hotel, write admin
  foreach t in array array['rate_plans', 'promos'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %I_select on public.%I for select to authenticated
      using (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','room_attendant','operations_manager','managing_officer','admin']))$f$, t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($f$create policy %I_write on public.%I for all to authenticated
      using (public.has_any_role(array['admin']))
      with check (public.has_any_role(array['admin']))$f$, t, t);
  end loop;

  -- operational tables: read hotel+oversight, write cashier/monitoring/admin
  foreach t in array array['stays', 'stay_extensions', 'stay_payments'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %I_select on public.%I for select to authenticated
      using (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','room_attendant','operations_manager','managing_officer','admin']))$f$, t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($f$create policy %I_write on public.%I for all to authenticated
      using (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','admin']))
      with check (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','admin']))$f$, t, t);
  end loop;
end $$;
