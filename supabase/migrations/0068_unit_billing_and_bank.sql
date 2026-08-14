-- 0068: Unit rate cards, billing ledger, bank assignment on collections
-- Rate card: what to charge per unit/item each month
create table public.unit_rate_cards (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units(id) on delete cascade,
  item_key      text not null,
  label         text not null,
  monthly_amount numeric(14,2) not null default 0,
  effective_from date not null default current_date,
  effective_until date,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (unit_id, item_key, effective_from)
);

-- Billing ledger: one row per unit / billing period / item
-- amount_paid is updated when linked collection rows are committed/deleted
create table public.unit_bills (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references public.units(id) on delete cascade,
  period_month  date not null,   -- first day of billing month
  item_key      text not null,
  label         text not null,
  amount_billed numeric(14,2) not null default 0,
  amount_paid   numeric(14,2) not null default 0,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (unit_id, period_month, item_key)
);

-- Link a collection row back to the bill it pays (optional)
alter table public.collections
  add column if not exists bank_account       text,
  add column if not exists collection_group_id uuid,
  add column if not exists unit_bill_id        uuid references public.unit_bills(id) on delete set null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.unit_rate_cards enable row level security;
alter table public.unit_bills       enable row level security;

-- Rate cards: read for all authenticated; write for monitoring/accounting/admin
create policy "rate_cards_select" on public.unit_rate_cards for select
  using (auth.uid() is not null);

create policy "rate_cards_insert" on public.unit_rate_cards for insert
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key in (
          'hotel_rental_monitoring','accounting','admin','managing_officer','consultant'
        )
    )
  );

create policy "rate_cards_update" on public.unit_rate_cards for update
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key in (
          'hotel_rental_monitoring','accounting','admin','managing_officer','consultant'
        )
    )
  );

-- Bills: read for monitoring/accounting/admin; write for same
create policy "unit_bills_select" on public.unit_bills for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key in (
          'hotel_rental_monitoring','accounting','admin','managing_officer','consultant'
        )
    )
  );

create policy "unit_bills_insert" on public.unit_bills for insert
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key in (
          'hotel_rental_monitoring','accounting','admin','managing_officer','consultant'
        )
    )
  );

create policy "unit_bills_update" on public.unit_bills for update
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key in (
          'hotel_rental_monitoring','accounting','admin','managing_officer','consultant'
        )
    )
  );
