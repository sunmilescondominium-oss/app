-- =============================================================================
-- Migration 0017 — Kiosk privacy settings
--
-- The attendance kiosk is a public URL. These DB-driven settings let HR gate it
-- with an access code (entered once per device, stored in a cookie) and choose
-- whether the board shows photos or initials only — adjustable without a deploy.
-- =============================================================================

create table if not exists public.kiosk_settings (
  id          int primary key default 1,
  access_code text    not null default '',    -- blank = open (no gate)
  show_photos boolean not null default true,
  updated_at  timestamptz not null default now(),
  constraint kiosk_settings_singleton check (id = 1)
);
insert into public.kiosk_settings (id) values (1) on conflict (id) do nothing;

alter table public.kiosk_settings enable row level security;

drop policy if exists kiosk_settings_select on public.kiosk_settings;
create policy kiosk_settings_select on public.kiosk_settings for select to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'consultant', 'accounting', 'warehouse_timekeeper']));

drop policy if exists kiosk_settings_write on public.kiosk_settings;
create policy kiosk_settings_write on public.kiosk_settings for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'consultant', 'accounting', 'warehouse_timekeeper']))
  with check (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'consultant', 'accounting', 'warehouse_timekeeper']));
