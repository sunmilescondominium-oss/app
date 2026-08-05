-- =============================================================================
-- Migration 0043 — On-demand kiosk camera + fixed-salary (no-DTR) staff flag.
-- =============================================================================

-- Kiosk camera is no longer always-on: it turns on for a limited window when
-- someone clocks in/out, and stays on longer during rush windows (arrival /
-- departure) when many people punch at once.
alter table public.kiosk_settings add column if not exists camera_seconds      int  not null default 45;
alter table public.kiosk_settings add column if not exists camera_rush_seconds int  not null default 180;
alter table public.kiosk_settings add column if not exists rush_windows        text not null default '06:00-09:00,16:00-19:00';

-- Fixed-salary staff (e.g. managers on a monthly rate) don't file a DTR — mark
-- them so payroll skips DTR computation and the kiosk stops "expecting" them.
alter table public.staff_pay add column if not exists dtr_exempt boolean not null default false;
