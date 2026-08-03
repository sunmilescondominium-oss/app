-- =============================================================================
-- Migration 0034 — Inventory dispensing / stock-movement audit log
--
-- Every supply movement (issue/dispense, receive, adjust, physical count,
-- housekeeping replacement) is logged with the staff who did it and the
-- resulting balance — for audit and the periodical physical count.
-- =============================================================================

create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  supply_id     uuid not null references public.room_supplies(id) on delete cascade,
  delta         numeric(10, 2) not null,      -- negative = issued/dispensed
  reason        text not null check (reason in ('issue', 'receive', 'adjust', 'count', 'replacement')),
  balance_after numeric(10, 2) not null,
  actor_user_id uuid references auth.users(id),
  actor_role    text,
  note          text,
  ref_task      uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_stock_movements_supply on public.stock_movements(supply_id, created_at desc);
create index if not exists idx_stock_movements_at on public.stock_movements(created_at desc);

alter table public.stock_movements enable row level security;
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.has_any_role(array['admin', 'operations_manager', 'managing_officer', 'room_attendant', 'warehouse_timekeeper', 'accounting']));
