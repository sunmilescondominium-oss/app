-- =============================================================================
-- Migration 0035 — Multi-bank accounts, ledger, reconciliation & check register
--
-- Accounting handles several bank accounts where collections are deposited and
-- from which disbursements (checks) are released. This gives each account its
-- own ledger, a running/available balance for proper check-release balancing,
-- and a bank-reconciliation snapshot (book-cleared vs statement balance).
--
-- Role-based only — no staff names. Counterparties are roles/vendors/purposes.
-- =============================================================================

create table if not exists public.bank_accounts (
  id                uuid primary key default gen_random_uuid(),
  label             text not null,                       -- purpose-based, e.g. "Collections – Main"
  bank_name         text,                                -- TODO(client-confirm)
  account_no_masked text,                                -- store masked only (RA 10173)
  account_type      text not null default 'collection'
                    check (account_type in ('collection', 'disbursement', 'payroll', 'general')),
  opening_balance   numeric(14, 2) not null default 0,
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  note              text,
  created_at        timestamptz not null default now()
);

create table if not exists public.bank_transactions (
  id               uuid primary key default gen_random_uuid(),
  bank_account_id  uuid not null references public.bank_accounts(id) on delete cascade,
  txn_date         date not null default current_date,
  direction        text not null check (direction in ('in', 'out')),
  amount           numeric(14, 2) not null check (amount > 0),
  kind             text not null
                   check (kind in ('deposit', 'check', 'withdrawal', 'transfer', 'bank_charge', 'interest', 'adjustment')),
  reference        text,                                  -- check no. / deposit slip ref
  counterparty     text,                                  -- payee role / source (no person names)
  memo             text,
  status           text not null default 'pending'
                   check (status in ('pending', 'cleared', 'void')),
  cleared_on       date,
  transmittal_id   uuid references public.transmittals(id) on delete set null,
  created_by       uuid references auth.users(id) on delete set null,
  actor_role       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_bank_txn_account on public.bank_transactions(bank_account_id, txn_date desc, created_at desc);
create index if not exists idx_bank_txn_status on public.bank_transactions(status);
create index if not exists idx_bank_txn_transmittal on public.bank_transactions(transmittal_id);

drop trigger if exists trg_bank_txn_updated_at on public.bank_transactions;
create trigger trg_bank_txn_updated_at
  before update on public.bank_transactions
  for each row execute function public.set_updated_at();

-- Reconciliation snapshot: book-cleared balance vs bank statement on a date.
create table if not exists public.bank_reconciliations (
  id                   uuid primary key default gen_random_uuid(),
  bank_account_id      uuid not null references public.bank_accounts(id) on delete cascade,
  statement_date       date not null,
  statement_balance    numeric(14, 2) not null,
  book_cleared_balance numeric(14, 2) not null,
  difference           numeric(14, 2) not null,
  reconciled_by_role   text,
  note                 text,
  created_at           timestamptz not null default now()
);
create index if not exists idx_bank_recon_account on public.bank_reconciliations(bank_account_id, statement_date desc);

-- RLS -------------------------------------------------------------------------
alter table public.bank_accounts        enable row level security;
alter table public.bank_transactions    enable row level security;
alter table public.bank_reconciliations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bank_accounts', 'bank_transactions', 'bank_reconciliations'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.has_any_role(array[''admin'', ''accounting'', ''managing_officer'', ''owner'', ''consultant'']))',
      t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated using (public.has_any_role(array[''admin'', ''accounting''])) with check (public.has_any_role(array[''admin'', ''accounting'']))',
      t, t);
  end loop;
end $$;

-- Example accounts (purpose-based; accounting can rename/add). ------------------
insert into public.bank_accounts (label, account_type, sort_order, note)
select 'Collections – Main', 'collection', 1, 'Primary deposit account for daily collections.'
where not exists (select 1 from public.bank_accounts);
insert into public.bank_accounts (label, account_type, sort_order, note)
select 'Disbursement – Checks', 'disbursement', 2, 'Account used to release checks to suppliers/payees.'
where (select count(*) from public.bank_accounts) = 1;
