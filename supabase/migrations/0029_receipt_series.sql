-- =============================================================================
-- Migration 0029 — Monitoring-configured Acknowledgement Receipt series
--
-- Hotel & Rental monitoring enters the AR series (prefix + next number) that
-- matches their physical receipt booklets, per context. next_receipt_no()
-- atomically issues and advances the next number.
-- =============================================================================

create table if not exists public.receipt_series (
  context    text primary key check (context in ('hotel', 'rental')),
  prefix     text   not null default 'AR-',
  next_no    bigint not null default 1,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.receipt_series (context, prefix, next_no)
values ('hotel', 'AR-', 1), ('rental', 'AR-', 1)
on conflict (context) do nothing;

create or replace function public.next_receipt_no(ctx text) returns text
language plpgsql as $$
declare pfx text; used bigint;
begin
  update public.receipt_series set next_no = next_no + 1, updated_at = now()
  where context = ctx returning prefix, next_no - 1 into pfx, used;
  if not found then return null; end if;
  return pfx || lpad(used::text, 6, '0');
end $$;

alter table public.rental_dues add column if not exists ar_no text;

alter table public.receipt_series enable row level security;
drop policy if exists receipt_series_select on public.receipt_series;
create policy receipt_series_select on public.receipt_series for select to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'accounting', 'hotel_rental_monitoring', 'hotel_cashier', 'errand_liaison']));
drop policy if exists receipt_series_write on public.receipt_series;
create policy receipt_series_write on public.receipt_series for all to authenticated
  using (public.has_any_role(array['admin', 'hotel_rental_monitoring']))
  with check (public.has_any_role(array['admin', 'hotel_rental_monitoring']));
