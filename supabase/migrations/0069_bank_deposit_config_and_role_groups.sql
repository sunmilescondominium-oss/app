-- =============================================================================
-- Migration 0069 — Bank deposit config + role groups + module permission overrides
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.  Bank deposit config per collection category
--     Accounting manages: which bank, which item types typically go there.
-- ---------------------------------------------------------------------------
create table if not exists public.bank_deposit_configs (
  id         uuid        primary key default gen_random_uuid(),
  category   text        not null unique,  -- matches COLLECTION_CATEGORIES keys
  bank_name  text        not null,
  items      text[]      not null default '{}',  -- item keys from BILLING_ITEM_TYPES
  notes      text,
  updated_by uuid        references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Seed confirmed bank assignments
insert into public.bank_deposit_configs (category, bank_name, items, notes) values
  ('hotel',       'China Bank', array['room_charge','food_orders','extra_services','miscellaneous'],
   'Hotel / Short-Stay operations — daily remittance to China Bank'),
  ('rental',      'BDO',        array['rent','water','electric','parking','miscellaneous'],
   'Residential rental units H01–H35 — BDO'),
  ('airbnb',      'PNB',        array['rent','parking','miscellaneous'],
   'Airbnb pool collections — PNB'),
  ('condo_sales', 'PNB',        array['amortization','downpayment','reservation','association_dues','electric','water','parking','miscellaneous'],
   'Condo sales amortization, dues, utilities — PNB'),
  ('parking',     'PNB',        array['parking'],
   'Standalone parking — PNB'),
  ('utility',     'BDO',        array['electric','water'],
   'Standalone utility billing — BDO'),
  ('other',       'BDO',        array['miscellaneous'],
   'Miscellaneous / other — BDO')
on conflict (category) do nothing;

-- ---------------------------------------------------------------------------
-- 2.  Role groups — logical groupings for the permission matrix admin
-- ---------------------------------------------------------------------------
create table if not exists public.role_groups (
  group_key   text primary key,
  label       text not null,
  description text,
  sort_order  int  not null default 0
);

create table if not exists public.role_group_members (
  group_key text not null references public.role_groups(group_key) on delete cascade,
  role_key  text not null,
  primary key (group_key, role_key)
);

insert into public.role_groups (group_key, label, description, sort_order) values
  ('management', 'Management',          'Admin, managing officer, operations manager, consultant',  1),
  ('hotel_ops',  'Hotel Operations',    'Hotel cashier, monitoring, room attendant',                2),
  ('finance',    'Finance & Accounting','Accounting, errand & liaison',                             3),
  ('support',    'Security & Support',  'Guard, warehouse, timekeeper',                             4),
  ('external',   'External',            'Property owners and buyer portal access',                  5)
on conflict (group_key) do nothing;

insert into public.role_group_members (group_key, role_key) values
  ('management', 'admin'),
  ('management', 'managing_officer'),
  ('management', 'operations_manager'),
  ('management', 'consultant'),
  ('hotel_ops',  'hotel_cashier'),
  ('hotel_ops',  'hotel_rental_monitoring'),
  ('hotel_ops',  'room_attendant'),
  ('finance',    'accounting'),
  ('finance',    'errand_liaison'),
  ('support',    'guard'),
  ('support',    'warehouse_timekeeper'),
  ('external',   'owner')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3.  Module role permission overrides
--     DB records override the hardcoded defaults in lib/rbac/modules.ts.
--     Admin can toggle group/role access per module without code deployment.
-- ---------------------------------------------------------------------------
create table if not exists public.module_role_permissions (
  module_key text        not null,
  role_key   text        not null,
  can_read   boolean     not null default false,
  can_write  boolean     not null default false,
  updated_by uuid        references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (module_key, role_key)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.bank_deposit_configs    enable row level security;
alter table public.role_groups             enable row level security;
alter table public.role_group_members      enable row level security;
alter table public.module_role_permissions enable row level security;

-- Bank config: accounting + management can read and write
drop policy if exists bank_cfg_sel on public.bank_deposit_configs;
create policy bank_cfg_sel on public.bank_deposit_configs for select to authenticated
  using (has_any_role(array[
    'admin','managing_officer','accounting','consultant','hotel_rental_monitoring']));

drop policy if exists bank_cfg_mod on public.bank_deposit_configs;
create policy bank_cfg_mod on public.bank_deposit_configs for all to authenticated
  using (has_any_role(array['admin','managing_officer','accounting','consultant']))
  with check (has_any_role(array['admin','managing_officer','accounting','consultant']));

-- Role groups: management/consultant read-only
drop policy if exists role_grp_sel on public.role_groups;
create policy role_grp_sel on public.role_groups for select to authenticated
  using (has_any_role(array['admin','managing_officer','consultant']));

drop policy if exists role_grp_mem_sel on public.role_group_members;
create policy role_grp_mem_sel on public.role_group_members for select to authenticated
  using (has_any_role(array['admin','managing_officer','consultant']));

-- Module permission overrides: admin reads and writes; consultant read
drop policy if exists mod_perms_sel on public.module_role_permissions;
create policy mod_perms_sel on public.module_role_permissions for select to authenticated
  using (has_any_role(array['admin','managing_officer','consultant']));

drop policy if exists mod_perms_mod on public.module_role_permissions;
create policy mod_perms_mod on public.module_role_permissions for all to authenticated
  using (has_any_role(array['admin','managing_officer']))
  with check (has_any_role(array['admin','managing_officer']));
