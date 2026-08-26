-- =============================================================================
-- Migration 0085 — Room maintenance tracking + demo mode
--
-- 1. hotel_maintenance_issues  — issues reported during room transfers; persist
--    on the room card for 1 month OR 5 room uses after resolution.
-- 2. stays.is_demo             — flags stays created during consultant demo mode.
-- 3. housekeeping_tasks.completed_by_name — denormalised cleaner label so the
--    room card can show who last cleaned without a join.
-- =============================================================================

-- ── 1. Maintenance issues ────────────────────────────────────────────────────

create table if not exists public.hotel_maintenance_issues (
  id               uuid primary key default gen_random_uuid(),
  unit_id          uuid not null references public.units(id) on delete cascade,
  transfer_id      uuid references public.hotel_room_transfers(id) on delete set null,
  description      text not null,
  status           text not null default 'open'
                     check (status in ('open', 'in_progress', 'resolved')),
  reported_by      uuid references auth.users(id) on delete set null,
  reporter_name    text,
  reported_at      timestamptz not null default now(),
  resolved_by      uuid references auth.users(id) on delete set null,
  resolver_name    text,
  resolved_at      timestamptz,
  fix_report       text,
  stays_after_fix  int not null default 0,
  visible_until    timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.hotel_maintenance_issues enable row level security;

create policy "hotel_maint_auth_select" on public.hotel_maintenance_issues
  for select using (auth.uid() is not null);

create policy "hotel_maint_auth_insert" on public.hotel_maintenance_issues
  for insert with check (auth.uid() is not null);

create policy "hotel_maint_auth_update" on public.hotel_maintenance_issues
  for update using (auth.uid() is not null);

create index if not exists idx_hotel_maint_unit
  on public.hotel_maintenance_issues(unit_id, status, reported_at desc);

-- ── 2. Demo mode ─────────────────────────────────────────────────────────────

alter table public.stays
  add column if not exists is_demo boolean not null default false;

-- ── 3. Cleaner name on housekeeping tasks ────────────────────────────────────

alter table public.housekeeping_tasks
  add column if not exists completed_by_name text;
