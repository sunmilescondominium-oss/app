-- =============================================================================
-- Migration 0083 — Hotel extra features
--
-- 1. Extra person charge on stays (admin-configurable rate, stored as snapshot)
-- 2. Room transfer tracking (within 10 min = timer resets; after = +5 min)
-- 3. Stay void / cancel check-in audit table (supervisor action with reason)
-- 4. Extends stays.status to include 'voided'
-- =============================================================================

-- 1. Extra persons on stays ------------------------------------------------
alter table public.stays add column if not exists extra_persons      int            not null default 0;
alter table public.stays add column if not exists extra_person_rate  numeric(12,2)  not null default 0;
alter table public.stays add column if not exists extra_person_amount numeric(12,2) not null default 0;

-- Transfer origin (set on the NEW stay when it was created via room transfer)
alter table public.stays add column if not exists transfer_from_stay_id uuid references public.stays(id) on delete set null;

-- 2. Extra person rate setting (singleton row) --------------------------------
create table if not exists public.hotel_extra_settings (
  id                 int primary key default 1,
  extra_person_rate  numeric(12,2) not null default 0,
  updated_at         timestamptz   not null default now(),
  constraint hotel_extra_settings_singleton check (id = 1)
);
insert into public.hotel_extra_settings (id, extra_person_rate)
  values (1, 0)
  on conflict (id) do nothing;

alter table public.hotel_extra_settings enable row level security;
drop policy if exists "extra_settings_read"  on public.hotel_extra_settings;
drop policy if exists "extra_settings_write" on public.hotel_extra_settings;
create policy "extra_settings_read"  on public.hotel_extra_settings for select to authenticated using (true);
create policy "extra_settings_write" on public.hotel_extra_settings for all    to authenticated
  using  (public.has_any_role(array['admin','consultant']))
  with check (public.has_any_role(array['admin','consultant']));

-- 3. Room transfers log -------------------------------------------------------
create table if not exists public.hotel_room_transfers (
  id              uuid primary key default gen_random_uuid(),
  from_stay_id    uuid not null references public.stays(id) on delete cascade,
  to_stay_id      uuid references public.stays(id) on delete set null,
  from_unit_id    uuid not null references public.units(id),
  to_unit_id      uuid not null references public.units(id),
  within_10_min   boolean not null,
  transfer_reason text not null check (transfer_reason in ('room_issue','maintenance','guest_preference','other')),
  remarks         text,
  performed_by    uuid references auth.users(id) on delete set null,
  transferred_at  timestamptz not null default now()
);
create index if not exists idx_hotel_room_transfers_from on public.hotel_room_transfers(from_stay_id);

alter table public.hotel_room_transfers enable row level security;
drop policy if exists "transfers_read"   on public.hotel_room_transfers;
drop policy if exists "transfers_insert" on public.hotel_room_transfers;
create policy "transfers_read"   on public.hotel_room_transfers for select to authenticated
  using (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','admin','managing_officer','accounting','consultant']));
create policy "transfers_insert" on public.hotel_room_transfers for insert to authenticated
  with check (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','admin','managing_officer','consultant']));

-- 4. Stay voids / void-extension audit ----------------------------------------
-- Extend the stays status enum to include 'voided'
alter table public.stays drop constraint if exists stays_status_check;
alter table public.stays add constraint stays_status_check
  check (status in ('active','checked_out','voided'));

create table if not exists public.hotel_stay_voids (
  id            uuid primary key default gen_random_uuid(),
  stay_id       uuid not null references public.stays(id) on delete cascade,
  void_type     text not null check (void_type in ('cancel_checkin','delete_extension')),
  extension_id  uuid references public.stay_extensions(id) on delete set null,
  reason        text not null,
  voided_by     uuid references auth.users(id) on delete set null,
  voider_name   text,
  voided_at     timestamptz not null default now()
);
create index if not exists idx_hotel_stay_voids_stay on public.hotel_stay_voids(stay_id);

alter table public.hotel_stay_voids enable row level security;
drop policy if exists "stay_voids_read"   on public.hotel_stay_voids;
drop policy if exists "stay_voids_insert" on public.hotel_stay_voids;
create policy "stay_voids_read"   on public.hotel_stay_voids for select to authenticated
  using (public.has_any_role(array['hotel_rental_monitoring','admin','managing_officer','accounting','consultant']));
create policy "stay_voids_insert" on public.hotel_stay_voids for insert to authenticated
  with check (public.has_any_role(array['hotel_rental_monitoring','admin','managing_officer','consultant']));
