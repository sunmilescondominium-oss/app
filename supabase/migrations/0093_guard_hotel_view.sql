-- =============================================================================
-- Migration 0093 — Guard Hotel View
--
-- Enables the guard to see only occupied hotel rooms with:
--   • Declared guest headcount (set by cashier at check-in)
--   • Guard entry confirmation per room (how many actually entered)
--   • Guard exit confirmation (gate pass verified at departure)
--   • Room transfer acknowledgment (guard must confirm any room change)
--   • Additional person event log (mid-stay extra arrivals, Phase 3)
--   • Guard-to-cashier alert channel (Phase 3)
--   • Feature flag toggle (admin enables when guard team is ready)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Feature flag — admin can toggle guard hotel view on/off
-- ---------------------------------------------------------------------------
insert into public.feature_flags (key, label, enabled)
values ('guard_hotel_view', 'Guard: Hotel Room View', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- stays — guest headcount + guard confirmation columns
-- ---------------------------------------------------------------------------

-- Total declared guests in party (cashier sets at check-in, guard verifies)
alter table public.stays
  add column if not exists guest_count smallint not null default 1;

-- Guard entry confirmation
alter table public.stays
  add column if not exists guard_entry_confirmed     boolean     not null default false;
alter table public.stays
  add column if not exists guard_entry_count         smallint;            -- how many guard confirmed entered
alter table public.stays
  add column if not exists guard_entry_confirmed_at  timestamptz;
alter table public.stays
  add column if not exists guard_entry_confirmed_by  uuid
    references public.profiles(id) on delete set null;

-- Guard exit confirmation (gate pass verified)
alter table public.stays
  add column if not exists guard_exit_confirmed      boolean     not null default false;
alter table public.stays
  add column if not exists guard_exit_confirmed_at   timestamptz;
alter table public.stays
  add column if not exists guard_exit_confirmed_by   uuid
    references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- hotel_room_transfers — guard must acknowledge any transfer
-- ---------------------------------------------------------------------------
alter table public.hotel_room_transfers
  add column if not exists guard_acknowledged     boolean     not null default false;
alter table public.hotel_room_transfers
  add column if not exists guard_acknowledged_at  timestamptz;
alter table public.hotel_room_transfers
  add column if not exists guard_acknowledged_by  uuid
    references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- hotel_stay_person_events — mid-stay additional person tracking (Phase 3)
--
-- Lifecycle per additional person arrival:
--   1. guard INSERT event_type='additional_reported'  — guard flags person at gate
--   2. cashier UPDATE fee_collected_at                — cashier collects & marks paid
--   3. guard UPDATE confirmed_at                      — guard confirms person entered
-- ---------------------------------------------------------------------------
create table if not exists public.hotel_stay_person_events (
  id               uuid primary key default gen_random_uuid(),
  stay_id          uuid not null references public.stays(id) on delete cascade,
  event_type       text not null
                   check (event_type in ('additional_reported', 'fee_collected', 'entry_confirmed')),
  person_count     smallint not null default 1,
  reported_by      uuid references public.profiles(id) on delete set null,
  fee_amount       numeric(12, 2),
  fee_session_id   uuid references public.hotel_cashier_sessions(id) on delete set null,
  fee_collected_by uuid references public.profiles(id) on delete set null,
  fee_collected_at timestamptz,
  confirmed_by     uuid references public.profiles(id) on delete set null,
  confirmed_at     timestamptz,
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_stay_person_events_stay
  on public.hotel_stay_person_events(stay_id, created_at desc);

alter table public.hotel_stay_person_events enable row level security;

create policy "person_events_read" on public.hotel_stay_person_events
  for select to authenticated
  using (public.has_any_role(array[
    'guard', 'hotel_cashier', 'hotel_rental_monitoring',
    'admin', 'managing_officer', 'accounting', 'consultant', 'owner'
  ]));

create policy "person_events_guard_insert" on public.hotel_stay_person_events
  for insert to authenticated
  with check (
    reported_by = auth.uid()
    and public.has_any_role(array['guard'])
    and event_type = 'additional_reported'
  );

create policy "person_events_cashier_update" on public.hotel_stay_person_events
  for update to authenticated
  using (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring', 'admin', 'managing_officer'
  ]));

-- ---------------------------------------------------------------------------
-- hotel_guard_alerts — guard-to-cashier real-time alerts (Phase 3)
-- ---------------------------------------------------------------------------
create table if not exists public.hotel_guard_alerts (
  id           uuid primary key default gen_random_uuid(),
  stay_id      uuid not null references public.stays(id) on delete cascade,
  alert_type   text not null
               check (alert_type in ('additional_person', 'unauthorized_entry', 'gate_query')),
  message      text,
  raised_by    uuid references public.profiles(id) on delete set null,
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_guard_alerts_stay
  on public.hotel_guard_alerts(stay_id, created_at desc);
create index if not exists idx_guard_alerts_unresolved
  on public.hotel_guard_alerts(stay_id) where not resolved;

alter table public.hotel_guard_alerts enable row level security;

create policy "guard_alerts_select" on public.hotel_guard_alerts
  for select to authenticated
  using (public.has_any_role(array[
    'guard', 'hotel_cashier', 'hotel_rental_monitoring',
    'admin', 'managing_officer', 'consultant', 'owner'
  ]));

create policy "guard_alerts_guard_insert" on public.hotel_guard_alerts
  for insert to authenticated
  with check (
    raised_by = auth.uid()
    and public.has_any_role(array['guard'])
  );

create policy "guard_alerts_resolve" on public.hotel_guard_alerts
  for update to authenticated
  using (public.has_any_role(array[
    'hotel_cashier', 'hotel_rental_monitoring',
    'admin', 'managing_officer', 'consultant'
  ]));
