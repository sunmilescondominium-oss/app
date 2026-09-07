-- =============================================================================
-- 0105 · General Expenses + Petty Cash
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Expense categories (admin/accounting configurable)
-- ---------------------------------------------------------------------------
create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 100,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists idx_expense_categories_name on public.expense_categories(lower(name));

-- Seed default categories
insert into public.expense_categories (name, description, sort_order) values
  ('Office Supplies',      'Paper, pens, toner, printer consumables',           10),
  ('Utilities',            'Electricity, water, internet, phone',               20),
  ('Meals & Entertainment','Business meals, staff snacks, client entertainment', 30),
  ('Transportation',       'Gas, toll, parking, fare, vehicle maintenance',      40),
  ('Repairs & Maintenance','Minor repairs not covered by Housekeeping',          50),
  ('Professional Fees',    'Legal, audit, consultancy fees',                    60),
  ('Marketing',            'Printing, signage, digital ads',                    70),
  ('Bank Charges',         'Bank fees, transfer charges',                       80),
  ('Miscellaneous',        'Other expenses not fitting any category',            90)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Expense vendors / payees (admin/accounting configurable)
-- ---------------------------------------------------------------------------
create table if not exists public.expense_vendors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  contact     text,
  tin         text,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists idx_expense_vendors_name on public.expense_vendors(lower(name));

-- Seed common vendors
insert into public.expense_vendors (name) values
  ('Meralco'),
  ('PLDT'),
  ('Globe Telecom'),
  ('Maynilad'),
  ('Manila Water'),
  ('Lazada'),
  ('Shopee'),
  ('SM Store'),
  ('National Bookstore'),
  ('Petron'),
  ('Shell'),
  ('Caltex')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Expense approval settings
-- ---------------------------------------------------------------------------
create table if not exists public.expense_settings (
  id                      integer primary key default 1
                          check (id = 1),             -- singleton row
  approval_threshold      numeric(14,2) not null default 5000,
  approver_roles          text[] not null default array['admin','accounting','managing_officer'],
  petty_cash_draw_roles   text[] not null default array['admin','accounting'],
  updated_by              uuid references auth.users(id) on delete set null,
  updated_at              timestamptz not null default now()
);
insert into public.expense_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. Extend existing expenses table
-- ---------------------------------------------------------------------------
alter table public.expenses
  add column if not exists expense_category_id uuid references public.expense_categories(id) on delete set null,
  add column if not exists expense_vendor_id   uuid references public.expense_vendors(id)    on delete set null,
  add column if not exists bank_account_id     uuid references public.bank_accounts(id)      on delete set null,
  add column if not exists source              text not null default 'bank'
                           check (source in ('bank','petty_cash','import')),
  add column if not exists proof_url           text,
  add column if not exists approval_status     text not null default 'approved'
                           check (approval_status in ('pending','approved','rejected')),
  add column if not exists approved_by         uuid references auth.users(id) on delete set null,
  add column if not exists approved_at         timestamptz;

-- Allow 'general' business line (was not in original constraint)
-- Drop and recreate the check constraint to add 'general'
alter table public.expenses drop constraint if exists expenses_business_line_check;
alter table public.expenses
  add constraint expenses_business_line_check
  check (business_line in ('condo_sales','rental','hotel','airbnb','parking','utility','other','general'));

-- Update existing rows that have no source set
update public.expenses set source = 'import' where source = 'bank' and bank_account_id is null;

create index if not exists idx_expenses_category on public.expenses(expense_category_id);
create index if not exists idx_expenses_vendor   on public.expenses(expense_vendor_id);
create index if not exists idx_expenses_source   on public.expenses(source);

-- ---------------------------------------------------------------------------
-- 5. Petty cash funds
-- ---------------------------------------------------------------------------
create table if not exists public.petty_cash_funds (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null default 'Main Petty Cash',
  custodian_user_id     uuid references auth.users(id) on delete set null,
  low_balance_threshold numeric(14,2) not null default 500,
  pcv_prefix            text not null default 'PCV',
  pcv_sequence          integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);
-- Default fund
insert into public.petty_cash_funds (name) values ('Main Petty Cash') on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6. Petty cash transactions
-- ---------------------------------------------------------------------------
create table if not exists public.petty_cash_transactions (
  id              uuid primary key default gen_random_uuid(),
  fund_id         uuid not null references public.petty_cash_funds(id) on delete cascade,
  kind            text not null check (kind in ('load','disbursement')),
  amount          numeric(14,2) not null check (amount > 0),
  -- For loads: which bank account was withdrawn from
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  -- For disbursements: optional link to the expense record
  expense_id      uuid references public.expenses(id) on delete set null,
  pcv_no          text,                              -- e.g. PCV-001 (auto-assigned on disbursement)
  description     text,
  receipt_url     text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_pctxn_fund    on public.petty_cash_transactions(fund_id, created_at desc);
create index if not exists idx_pctxn_expense on public.petty_cash_transactions(expense_id);

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.expense_categories    enable row level security;
alter table public.expense_vendors       enable row level security;
alter table public.expense_settings      enable row level security;
alter table public.petty_cash_funds      enable row level security;
alter table public.petty_cash_transactions enable row level security;

-- Read: accounting, admin, managing_officer, consultant, owner
-- Write: accounting, admin
do $$ begin
  -- expense_categories
  drop policy if exists "expense_categories_read"  on public.expense_categories;
  drop policy if exists "expense_categories_write" on public.expense_categories;
  create policy "expense_categories_read"  on public.expense_categories for select using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting','managing_officer','consultant','owner'))
  );
  create policy "expense_categories_write" on public.expense_categories for all using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting'))
  );

  -- expense_vendors
  drop policy if exists "expense_vendors_read"  on public.expense_vendors;
  drop policy if exists "expense_vendors_write" on public.expense_vendors;
  create policy "expense_vendors_read"  on public.expense_vendors for select using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting','managing_officer','consultant','owner'))
  );
  create policy "expense_vendors_write" on public.expense_vendors for all using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting'))
  );

  -- expense_settings
  drop policy if exists "expense_settings_read"  on public.expense_settings;
  drop policy if exists "expense_settings_write" on public.expense_settings;
  create policy "expense_settings_read"  on public.expense_settings for select using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting','managing_officer','consultant','owner'))
  );
  create policy "expense_settings_write" on public.expense_settings for all using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting'))
  );

  -- petty_cash_funds
  drop policy if exists "petty_cash_funds_read"  on public.petty_cash_funds;
  drop policy if exists "petty_cash_funds_write" on public.petty_cash_funds;
  create policy "petty_cash_funds_read"  on public.petty_cash_funds for select using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting','managing_officer','consultant','owner'))
  );
  create policy "petty_cash_funds_write" on public.petty_cash_funds for all using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting'))
  );

  -- petty_cash_transactions
  drop policy if exists "pctxn_read"  on public.petty_cash_transactions;
  drop policy if exists "pctxn_write" on public.petty_cash_transactions;
  create policy "pctxn_read"  on public.petty_cash_transactions for select using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting','managing_officer','consultant','owner'))
  );
  create policy "pctxn_write" on public.petty_cash_transactions for all using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()
            and ur.role_key in ('admin','accounting'))
  );
end $$;
