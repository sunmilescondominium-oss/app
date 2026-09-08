-- =============================================================================
-- 0109 · Link expenses directly to petty_cash_funds + add opening_balance
-- =============================================================================

-- Direct FK from expense to the petty cash fund it drew from.
-- NULL when source = 'bank' or 'import'.
alter table public.expenses
  add column if not exists petty_cash_fund_id uuid references public.petty_cash_funds(id) on delete set null;

-- Opening balance lets the fund show a correct running total before any
-- transactions are recorded in petty_cash_transactions.
alter table public.petty_cash_funds
  add column if not exists opening_balance numeric(14,2) not null default 0;

create index if not exists idx_expenses_petty_cash_fund_id on public.expenses(petty_cash_fund_id);
