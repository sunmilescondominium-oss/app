-- =============================================================================
-- Migration 0041 — Purchase requisitions & materials inventory
--
-- Flow: staff request → operations endorse → accounting budget → (if over the
-- owner threshold) owner final approval → purchasing → receiving. Received goods
-- top up housekeeping supplies (room_supplies) and/or a new materials/tools/
-- equipment inventory (material_items). Role-based only.
-- =============================================================================

-- Materials / tools / equipment catalog + stock ------------------------------
create table if not exists public.material_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null default 'consumable' check (category in ('consumable', 'tool', 'equipment', 'material')),
  unit_label    text not null default 'pc',
  stock_qty     numeric(12, 2) not null default 0,
  reorder_level numeric(12, 2) not null default 0,
  target        text not null default 'materials' check (target in ('room_supplies', 'materials')),
  is_active     boolean not null default true,
  sort_order    int not null default 100,
  created_at    timestamptz not null default now()
);

create table if not exists public.requisition_settings (
  id              int primary key default 1 check (id = 1),
  owner_threshold numeric(14, 2) not null default 20000,
  updated_at      timestamptz not null default now()
);
insert into public.requisition_settings (id) values (1) on conflict do nothing;

create table if not exists public.requisitions (
  id                uuid primary key default gen_random_uuid(),
  ref_no            text unique,
  title             text not null,
  business_line     text,
  purpose           text,
  needed_by         date,
  status            text not null default 'submitted'
                    check (status in ('submitted', 'endorsed', 'budget_review', 'owner_review', 'approved', 'rejected', 'purchased', 'received', 'cancelled')),
  est_total         numeric(14, 2) not null default 0,
  requested_by_role text, requested_by_user uuid references auth.users(id) on delete set null,
  endorsed_by_role  text, endorsed_at timestamptz,
  budget_by_role    text, budget_at timestamptz,
  owner_by_role     text, owner_at timestamptz,
  reject_reason     text,
  supplier          text, actual_total numeric(14, 2), purchased_by_role text, purchased_at timestamptz,
  received_by_role  text, received_at timestamptz,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_requisitions_status on public.requisitions(status, created_at desc);

drop trigger if exists trg_requisitions_updated_at on public.requisitions;
create trigger trg_requisitions_updated_at before update on public.requisitions
  for each row execute function public.set_updated_at();

create table if not exists public.requisition_items (
  id             uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.requisitions(id) on delete cascade,
  item_id        uuid references public.material_items(id) on delete set null,
  item_name      text not null,
  category       text not null default 'consumable',
  unit_label     text not null default 'pc',
  qty            numeric(12, 2) not null default 1,
  est_unit_cost  numeric(12, 2) not null default 0,
  target         text not null default 'materials' check (target in ('room_supplies', 'materials')),
  received_qty   numeric(12, 2) not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists idx_req_items_req on public.requisition_items(requisition_id);

-- RLS -------------------------------------------------------------------------
alter table public.material_items       enable row level security;
alter table public.requisition_settings enable row level security;
alter table public.requisitions         enable row level security;
alter table public.requisition_items    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['material_items', 'requisition_settings', 'requisitions', 'requisition_items'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for select to authenticated using (public.has_any_role(array[''owner'',''consultant'',''admin'',''managing_officer'',''operations_manager'',''accounting'',''warehouse_timekeeper'',''errand_liaison'',''room_attendant'',''hotel_rental_monitoring'']))',
      t, t);
  end loop;
end $$;
