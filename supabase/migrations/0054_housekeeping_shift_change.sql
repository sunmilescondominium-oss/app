-- =============================================================================
-- 0054_housekeeping_shift_change.sql
--
-- Shift-change discipline for housekeeping:
--  * Per-room-type timers (buffer to START + target cleaning DURATION) and
--    per-room-type cleaning checklist. Set by admin, operations, and hotel &
--    rental monitoring. Applies to hotel + airbnb only (rentals are not
--    attendant-monitored; long-stay renters raise a cleaning request instead).
--  * Each cleaning task snapshots its room type's buffer / cleaning minutes and
--    a start_by deadline so the attendant board can show live countdowns and so
--    the system can decide (from the timers + the attendant's shift end) which
--    rooms must be endorsed to the next team rather than started.
--  * Escalation path for rooms that genuinely can't be finished once started.
-- =============================================================================

-- --- per-room-type config -----------------------------------------------------
create table if not exists public.housekeeping_room_types (
  id               uuid primary key default gen_random_uuid(),
  business_line    text not null check (business_line in ('hotel', 'airbnb')),
  unit_type        text,                       -- matches units.unit_type; NULL = default for the business line
  label            text not null,
  buffer_minutes   integer not null default 10 check (buffer_minutes >= 0),   -- SLA to START after checkout
  cleaning_minutes integer not null default 45 check (cleaning_minutes > 0),  -- target DURATION of the clean
  checklist        jsonb not null default '[]'::jsonb,                        -- per-type task list
  is_active        boolean not null default true,
  sort_order       integer not null default 100,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (business_line, unit_type)
);

drop trigger if exists trg_hk_room_types_updated_at on public.housekeeping_room_types;
create trigger trg_hk_room_types_updated_at before update on public.housekeeping_room_types
  for each row execute function public.set_updated_at();

alter table public.housekeeping_room_types enable row level security;

drop policy if exists hk_room_types_select on public.housekeeping_room_types;
create policy hk_room_types_select on public.housekeeping_room_types
  for select to authenticated using (true);

drop policy if exists hk_room_types_write on public.housekeeping_room_types;
create policy hk_room_types_write on public.housekeeping_room_types for all to authenticated
  using (public.has_any_role(array['admin', 'operations_manager', 'hotel_rental_monitoring']))
  with check (public.has_any_role(array['admin', 'operations_manager', 'hotel_rental_monitoring']));

-- --- cleaning-task SLA + endorsement/escalation fields ------------------------
alter table public.housekeeping_tasks
  add column if not exists business_line    text,
  add column if not exists unit_type        text,
  add column if not exists room_type_id     uuid references public.housekeeping_room_types(id) on delete set null,
  add column if not exists buffer_minutes   integer,
  add column if not exists cleaning_minutes integer,
  add column if not exists start_by         timestamptz,   -- checkout + buffer: must begin by this time
  add column if not exists endorsed         boolean not null default false,
  add column if not exists endorsed_at      timestamptz,
  add column if not exists escalated        boolean not null default false,
  add column if not exists escalation_note  text;

-- --- seed the default room types (TODO client-confirm times + per-type lists) --
-- Default fallback rows (unit_type NULL) for each monitored business line, plus
-- a couple of common hotel types. The standard checklist mirrors the app's
-- CLEANING_CHECKLIST; monitoring can edit per type from the Housekeeping page.
insert into public.housekeeping_room_types (business_line, unit_type, label, buffer_minutes, cleaning_minutes, checklist, sort_order)
values
  ('hotel',  null,       'Hotel — default', 10, 45,
     '[{"key":"linens","label":"Change bed linens"},{"key":"bathroom","label":"Sanitize bathroom"},{"key":"trash","label":"Empty trash"},{"key":"restock","label":"Restock supplies"},{"key":"floor","label":"Sweep & mop floor"},{"key":"aircon","label":"Wipe aircon & vents"}]'::jsonb, 10),
  ('airbnb', null,       'Airbnb — default', 15, 60,
     '[{"key":"linens","label":"Change bed linens"},{"key":"bathroom","label":"Sanitize bathroom"},{"key":"trash","label":"Empty trash"},{"key":"restock","label":"Restock supplies"},{"key":"kitchen","label":"Clean kitchen / utensils"},{"key":"floor","label":"Sweep & mop floor"},{"key":"aircon","label":"Wipe aircon & vents"}]'::jsonb, 20)
on conflict (business_line, unit_type) do nothing;
