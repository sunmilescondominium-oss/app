-- =============================================================================
-- Migration 0037 — Granular, DB-driven module permissions + new staff tiers
--
-- The code map in lib/rbac/modules.ts remains the DEFAULT. This table is an
-- OVERRIDE layer: a row for (role, module) wins over the default, so an admin
-- can grant/revoke a role's read/write on any module without a code change.
-- Absence of a row = fall back to the code default. Role-based only.
-- =============================================================================

create table if not exists public.role_permissions (
  role_key    text not null references public.roles(role_key) on delete cascade,
  module_key  text not null,
  can_read    boolean not null default false,
  can_write   boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by_role text,
  primary key (role_key, module_key)
);

alter table public.role_permissions enable row level security;

-- Everyone signed in may READ the permission map (needed to build the nav);
-- only admin / managing officer may change it.
drop policy if exists role_perms_select on public.role_permissions;
create policy role_perms_select on public.role_permissions for select to authenticated using (true);
drop policy if exists role_perms_write on public.role_permissions;
create policy role_perms_write on public.role_permissions for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer']))
  with check (public.has_any_role(array['admin', 'managing_officer']));

-- New granular staff tiers. Access starts empty (no code default) and is granted
-- from the Access Control screen — the point of the granular model.
insert into public.roles (role_key, label, description) values
  ('admin_staff',      'Admin Staff',      'General administrative staff; access granted per module.'),
  ('accounting_staff', 'Accounting Staff', 'Accounting support staff; access granted per module.'),
  ('marketing_staff',  'Marketing Staff',  'Marketing/sales support staff; access granted per module.'),
  ('hr_staff',         'HR Staff',         'Human-resources support staff; access granted per module.')
on conflict (role_key) do nothing;
