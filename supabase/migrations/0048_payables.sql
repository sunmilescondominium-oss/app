-- =============================================================================
-- Migration 0048 — Commissions & Payables.
--
-- Amounts owed to people: staff allowances, referral fees, broker commissions
-- (with sub-agents/salespersons + the broker's override), marketing funds,
-- incentives and rewards. Payees can form a hierarchy (agent → broker) so a
-- commission to an agent auto-creates the broker's override. Flow:
-- pending → approved → released, fully audited.
-- =============================================================================

create table if not exists public.payees (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null default 'staff' check (kind in ('broker', 'agent', 'salesperson', 'staff', 'supplier', 'other')),
  parent_payee_id uuid references public.payees(id) on delete set null,  -- an agent's broker
  override_rate   numeric(6, 4) not null default 0,  -- broker's override on this agent's commission (fraction, e.g. 0.02 = 2%)
  commission_rate numeric(6, 4) not null default 0,  -- default commission rate (reference)
  staff_user_id   uuid references auth.users(id) on delete set null,     -- if the payee is a system user
  tin             text,
  contact         text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_payees_parent on public.payees(parent_payee_id);

create table if not exists public.payables (
  id                uuid primary key default gen_random_uuid(),
  payee_id          uuid not null references public.payees(id) on delete restrict,
  ptype             text not null check (ptype in ('allowance', 'referral_fee', 'commission', 'override', 'marketing_fund', 'incentive', 'reward', 'other')),
  amount            numeric(14, 2) not null default 0,
  description       text,
  business_line     text,
  ref_no            text,
  parent_payable_id uuid references public.payables(id) on delete set null,  -- override → its base commission
  status            text not null default 'pending' check (status in ('pending', 'approved', 'released', 'cancelled')),
  requested_by      uuid references auth.users(id) on delete set null, requested_at timestamptz not null default now(),
  approved_by       uuid references auth.users(id) on delete set null, approved_at timestamptz,
  released_by       uuid references auth.users(id) on delete set null, released_at timestamptz,
  release_or_no     text, release_method text,
  remarks           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_payables_status on public.payables(status, created_at desc);
create index if not exists idx_payables_payee on public.payables(payee_id);

drop trigger if exists trg_payables_updated_at on public.payables;
create trigger trg_payables_updated_at before update on public.payables
  for each row execute function public.set_updated_at();

alter table public.payees    enable row level security;
alter table public.payables  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['payees', 'payables'] loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format(
      'create policy %I_sel on public.%I for select to authenticated using (public.has_any_role(array[''owner'',''consultant'',''admin'',''managing_officer'',''accounting'']))',
      t, t);
  end loop;
end $$;
