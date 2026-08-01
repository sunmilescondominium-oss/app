-- =============================================================================
-- Migration 0012 — P&L / Reports (Module 9)
--
-- Income is auto-pulled from collections; expenses are entered by accounting.
-- P&L per business line = income − expenses. finance_settings holds the output
-- VAT mode/rate for the sales report (config-driven; accounting confirms).
--
-- Idempotent.
-- =============================================================================

create table if not exists public.finance_settings (
  id         integer primary key default 1 check (id = 1),
  vat_mode   text not null default 'none' check (vat_mode in ('none', 'vat_inclusive', 'non_vat')),
  vat_rate   numeric(6, 4) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.finance_settings (id, vat_mode, vat_rate) values (1, 'none', 0)
  on conflict (id) do nothing;

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  business_line text not null default 'other'
                check (business_line in ('condo_sales', 'rental', 'hotel', 'airbnb', 'parking', 'utility', 'other')),
  category      text not null default 'Others',
  amount        numeric(14, 2) not null check (amount >= 0),
  expense_date  date not null default current_date,
  vendor        text,
  or_number     text,
  remarks       text,
  entered_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_expenses_date on public.expenses(expense_date desc);

-- ---------------------------------------------------------------------------
-- RLS — read = owner/managing_officer/consultant/accounting/admin · write = accounting/admin
-- ---------------------------------------------------------------------------
alter table public.finance_settings enable row level security;
alter table public.expenses         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['finance_settings', 'expenses'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %I_select on public.%I for select to authenticated
      using (public.has_any_role(array['owner','managing_officer','consultant','accounting','admin']))$f$, t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($f$create policy %I_write on public.%I for all to authenticated
      using (public.has_any_role(array['accounting','admin']))
      with check (public.has_any_role(array['accounting','admin']))$f$, t, t);
  end loop;
end $$;
