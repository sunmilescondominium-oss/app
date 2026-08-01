-- =============================================================================
-- Migration 0011 — Housekeeping (Hotel Phase C)
--
-- Room-supplies inventory, pre-checkout room asset check + gate pass, cleaning
-- tasks (auto-created on check-out), and an activity/turnover/replacement log.
-- Roles are person-agnostic: a "turnover" is a logged handoff on the shared
-- room_attendant role so the next shift continues the task.
--
-- Idempotent.
-- =============================================================================

create table if not exists public.room_supplies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  unit_label    text not null default 'pcs',
  stock_qty     numeric(10, 2) not null default 0,
  reorder_level numeric(10, 2) not null default 0,
  sort_order    integer not null default 100,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_room_supplies_updated_at on public.room_supplies;
create trigger trg_room_supplies_updated_at before update on public.room_supplies
  for each row execute function public.set_updated_at();

create table if not exists public.room_checks (
  id              uuid primary key default gen_random_uuid(),
  stay_id         uuid references public.stays(id) on delete cascade,
  unit_id         uuid references public.units(id) on delete set null,
  results         jsonb not null default '[]'::jsonb,
  notes           text,
  gatepass_no     text,
  checked_by_role text references public.roles(role_key),
  checked_at      timestamptz not null default now()
);
create index if not exists idx_room_checks_stay on public.room_checks(stay_id);

create table if not exists public.housekeeping_tasks (
  id               uuid primary key default gen_random_uuid(),
  unit_id          uuid references public.units(id) on delete set null,
  stay_id          uuid references public.stays(id) on delete set null,
  status           text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  assigned_to_role text references public.roles(role_key),
  shift            text,
  checklist        jsonb not null default '[]'::jsonb,
  notes            text,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_housekeeping_status on public.housekeeping_tasks(status);
create index if not exists idx_housekeeping_unit on public.housekeeping_tasks(unit_id);
drop trigger if exists trg_housekeeping_tasks_updated_at on public.housekeeping_tasks;
create trigger trg_housekeeping_tasks_updated_at before update on public.housekeeping_tasks
  for each row execute function public.set_updated_at();

create table if not exists public.housekeeping_events (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.housekeeping_tasks(id) on delete cascade,
  event_type    text not null,
  detail        jsonb,
  actor_role    text,
  actor_user_id uuid references auth.users(id) on delete set null,
  at            timestamptz not null default now()
);
create index if not exists idx_housekeeping_events_task on public.housekeeping_events(task_id, at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.room_supplies      enable row level security;
alter table public.room_checks        enable row level security;
alter table public.housekeeping_tasks enable row level security;
alter table public.housekeeping_events enable row level security;

do $$
declare t text;
begin
  -- read for hotel + housekeeping roles across all four
  foreach t in array array['room_supplies', 'room_checks', 'housekeeping_tasks', 'housekeeping_events'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %I_select on public.%I for select to authenticated
      using (public.has_any_role(array['room_attendant','hotel_cashier','hotel_rental_monitoring','operations_manager','managing_officer','admin']))$f$, t, t);
  end loop;
end $$;

-- supplies: write admin
drop policy if exists room_supplies_write on public.room_supplies;
create policy room_supplies_write on public.room_supplies for all to authenticated
  using (public.has_any_role(array['admin','operations_manager']))
  with check (public.has_any_role(array['admin','operations_manager']));

-- room checks: write cashier/monitoring/attendant/admin (pre-checkout at front desk)
drop policy if exists room_checks_write on public.room_checks;
create policy room_checks_write on public.room_checks for all to authenticated
  using (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','room_attendant','admin']))
  with check (public.has_any_role(array['hotel_cashier','hotel_rental_monitoring','room_attendant','admin']));

-- tasks + events: write room_attendant/ops/admin
do $$
declare t text;
begin
  foreach t in array array['housekeeping_tasks', 'housekeeping_events'] loop
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($f$create policy %I_write on public.%I for all to authenticated
      using (public.has_any_role(array['room_attendant','operations_manager','admin']))
      with check (public.has_any_role(array['room_attendant','operations_manager','admin']))$f$, t, t);
  end loop;
end $$;
