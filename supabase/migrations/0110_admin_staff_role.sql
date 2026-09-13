-- =============================================================================
-- 0110 — canonicalise admin_staff as a first-class role.
--
-- admin_staff existed in user_roles rows but was never in the roles table.
-- This migration seeds it properly so the Role Permissions UI shows it,
-- the roles catalog is complete, and foreign-key integrity is guaranteed.
--
-- Access summary (enforced in lib/rbac/modules.ts):
--   CAN  → employees (read), kiosk_fallback (read+write), scheduling (read+write),
--           hr (read), users (read), employee/my-attendance, chat, changelog
--   CANNOT → /admin/* (settings, role-permissions, flags, activity-log, health,
--              bank-config), invite users, edit collections, approve advances,
--              finance, banking, payables, petty cash, transmittals
-- =============================================================================

insert into public.roles (role_key, label, description, is_staff, sort_order)
values (
  'admin_staff',
  'Admin Staff',
  'Day-to-day office administration: attendance kiosk, shift scheduling, employee roster (read). Cannot access critical configuration (role permissions, feature flags, app settings, activity log, banking, payroll write).',
  true,
  65
)
on conflict (role_key) do update set
  label       = excluded.label,
  description = excluded.description,
  is_staff    = excluded.is_staff,
  sort_order  = excluded.sort_order;
