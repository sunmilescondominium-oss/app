-- =============================================================================
-- Migration 0090 — Guard Module
--
-- Guard posts, shifts, entrance log, referral drivers, stay referrals.
-- The guard entrance log is the independent physical record that the cashier
-- cannot touch, enabling cross-checks for pilferage detection.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- guard_posts — one row per physical posting (hotel gate, condo gate, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.guard_posts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.guard_posts (name, code)
values
  ('Hotel Entrance Gate',        'hotel_gate'),
  ('Condo/Rental Entrance Gate', 'condo_gate')
on conflict (code) do nothing;

alter table public.guard_posts enable row level security;
create policy guard_posts_read on public.guard_posts
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- guard_shifts — who is on duty at which post
-- ---------------------------------------------------------------------------
create table if not exists public.guard_shifts (
  id          uuid primary key default gen_random_uuid(),
  guard_id    uuid not null references public.profiles(id) on delete cascade,
  post_id     uuid not null references public.guard_posts(id),
  shift_type  text not null check (shift_type in ('day', 'night')),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_guard_shifts_guard   on public.guard_shifts(guard_id);
create index if not exists idx_guard_shifts_post    on public.guard_shifts(post_id);
create index if not exists idx_guard_shifts_open    on public.guard_shifts(guard_id) where ended_at is null;

alter table public.guard_shifts enable row level security;

create policy guard_shifts_insert on public.guard_shifts
  for insert to authenticated
  with check (guard_id = auth.uid() and public.has_any_role(array['guard']));

create policy guard_shifts_update_own on public.guard_shifts
  for update to authenticated
  using (guard_id = auth.uid() and public.has_any_role(array['guard']));

create policy guard_shifts_select on public.guard_shifts
  for select to authenticated
  using (
    guard_id = auth.uid()
    or public.has_any_role(array['admin','managing_officer','operations_manager',
                                   'hotel_rental_monitoring','consultant','owner'])
  );

-- ---------------------------------------------------------------------------
-- guard_entrance_log — every person/vehicle entering a guarded post
-- ---------------------------------------------------------------------------
create table if not exists public.guard_entrance_log (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references public.guard_posts(id),
  guard_shift_id   uuid references public.guard_shifts(id) on delete set null,
  logged_by        uuid not null references public.profiles(id),
  entry_type       text not null default 'guest'
                   check (entry_type in ('guest','vehicle','visitor','delivery','staff')),
  vehicle_type     text
                   check (vehicle_type in ('tricycle','car','van','motorcycle','other')),
  plate_number     text,
  driver_name      text,
  passenger_count  smallint,
  notes            text,
  time_in          timestamptz not null default now(),
  time_out         timestamptz,
  linked_stay_id   uuid references public.stays(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_guard_log_post    on public.guard_entrance_log(post_id);
create index if not exists idx_guard_log_plate   on public.guard_entrance_log(plate_number) where plate_number is not null;
create index if not exists idx_guard_log_time_in on public.guard_entrance_log(time_in);
create index if not exists idx_guard_log_stay    on public.guard_entrance_log(linked_stay_id) where linked_stay_id is not null;

alter table public.guard_entrance_log enable row level security;

-- Guard writes only their own entries; management + cashier read (for referral check)
create policy guard_log_insert on public.guard_entrance_log
  for insert to authenticated
  with check (logged_by = auth.uid() and public.has_any_role(array['guard']));

create policy guard_log_update_own on public.guard_entrance_log
  for update to authenticated
  using (logged_by = auth.uid() and public.has_any_role(array['guard']));

create policy guard_log_select on public.guard_entrance_log
  for select to authenticated
  using (
    logged_by = auth.uid()
    or public.has_any_role(array['admin','managing_officer','operations_manager',
                                   'hotel_rental_monitoring','hotel_cashier',
                                   'consultant','owner','accounting'])
  );

-- ---------------------------------------------------------------------------
-- referral_drivers — Phase 2: accredited driver registry (table ready now)
-- ---------------------------------------------------------------------------
create table if not exists public.referral_drivers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  plate_number  text not null unique,
  vehicle_type  text not null default 'tricycle',
  contact       text,
  status        text not null default 'active'
                check (status in ('active','suspended','inactive')),
  notes         text,
  accredited_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.referral_drivers enable row level security;

create policy referral_drivers_read on public.referral_drivers
  for select to authenticated
  using (public.has_any_role(array['admin','managing_officer','hotel_rental_monitoring',
                                    'hotel_cashier','consultant','accounting']));

create policy referral_drivers_write on public.referral_drivers
  for all to authenticated
  using  (public.has_any_role(array['admin','managing_officer','hotel_rental_monitoring','consultant']))
  with check (public.has_any_role(array['admin','managing_officer','hotel_rental_monitoring','consultant']));

-- ---------------------------------------------------------------------------
-- stay_referrals — one per stay; requires a matching guard log entry (hotel gate)
-- ---------------------------------------------------------------------------
create table if not exists public.stay_referrals (
  id              uuid primary key default gen_random_uuid(),
  stay_id         uuid not null unique references public.stays(id) on delete cascade,
  guard_log_id    uuid references public.guard_entrance_log(id) on delete set null,
  plate_number    text not null,
  referral_amount numeric(10,2) not null default 0,
  verified        boolean not null default false,
  driver_id       uuid references public.referral_drivers(id) on delete set null,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_stay_referrals_stay on public.stay_referrals(stay_id);

alter table public.stay_referrals enable row level security;

create policy stay_referrals_insert on public.stay_referrals
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_any_role(array['hotel_cashier','hotel_rental_monitoring',
                                   'admin','managing_officer','consultant'])
  );

create policy stay_referrals_select on public.stay_referrals
  for select to authenticated
  using (
    public.has_any_role(array['hotel_cashier','hotel_rental_monitoring',
                               'admin','managing_officer','consultant',
                               'accounting','owner'])
  );

-- ---------------------------------------------------------------------------
-- App settings — referral config
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, label, description)
values
  ('referral_fee_hotel',      '50',  'Hotel referral fee (₱)', 'Fee paid per tricycle/vehicle referral at the hotel gate.'),
  ('referral_window_minutes', '60',  'Referral window (minutes)', 'How many minutes back to search the guard entrance log when verifying a referral plate number.')
on conflict (key) do nothing;
