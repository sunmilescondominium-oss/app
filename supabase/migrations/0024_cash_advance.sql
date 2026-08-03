-- =============================================================================
-- Migration 0024 — Cash advance + liquidation
--
-- Workflow: pending → approved → released (disbursed) → liquidated.
-- Liquidation lines record how the advance was spent; the balance (advance −
-- liquidated) is a refund (excess) or reimbursement (shortfall). All mutations
-- run through role-gated server actions (service role); RLS restricts reads.
-- =============================================================================

create table if not exists public.cash_advances (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  amount           numeric(14, 2) not null check (amount > 0),
  purpose          text not null,
  needed_by        date,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'released', 'liquidated', 'cancelled')),
  decided_by       uuid references auth.users(id),
  decided_at       timestamptz,
  decision_note    text,
  released_by      uuid references auth.users(id),
  released_on      date,
  liquidated_total numeric(14, 2),
  liquidated_on    date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_advances_user on public.cash_advances(user_id, created_at desc);
create index if not exists idx_advances_status on public.cash_advances(status);

create table if not exists public.cash_advance_liquidations (
  id          uuid primary key default gen_random_uuid(),
  advance_id  uuid not null references public.cash_advances(id) on delete cascade,
  description text not null,
  amount      numeric(14, 2) not null check (amount >= 0),
  spent_on    date not null default current_date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_liquidations_advance on public.cash_advance_liquidations(advance_id);

drop trigger if exists trg_advances_updated_at on public.cash_advances;
create trigger trg_advances_updated_at before update on public.cash_advances for each row execute function public.set_updated_at();

alter table public.cash_advances             enable row level security;
alter table public.cash_advance_liquidations enable row level security;

drop policy if exists advances_select on public.cash_advances;
create policy advances_select on public.cash_advances for select to authenticated
  using (user_id = auth.uid()
         or public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'accounting']));

drop policy if exists liquidations_select on public.cash_advance_liquidations;
create policy liquidations_select on public.cash_advance_liquidations for select to authenticated
  using (exists (select 1 from public.cash_advances a
                 where a.id = advance_id
                   and (a.user_id = auth.uid()
                        or public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'accounting']))));
