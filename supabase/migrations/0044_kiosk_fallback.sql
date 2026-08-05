-- =============================================================================
-- Migration 0044 — Mobile-fallback attendance when the physical kiosk is down.
--
-- Flow: guard requests (kiosk down + employee IDs) → authorizer (owner /
-- managing_officer / consultant / operations_manager) approves → the system
-- shows a temporary expiring code in the guard portal → authorized employees
-- clock in/out from their phones with a mandatory selfie + best-effort GPS,
-- tagged source='mobile_fallback'. The instance closes when all listed staff
-- have punched, after a configurable number of hours, or when the guard
-- deactivates it. Everything is audit-logged.
-- =============================================================================

-- Configurable auto-expiry (hours) for a mobile-fallback window.
alter table public.kiosk_settings add column if not exists mobile_fallback_hours int not null default 4;

-- Mobile punches carry best-effort location + a link back to the outage instance.
alter table public.time_records add column if not exists geo_lat      numeric(9, 6);
alter table public.time_records add column if not exists geo_lng      numeric(9, 6);
alter table public.time_records add column if not exists geo_accuracy numeric(9, 2);
alter table public.time_records add column if not exists outage_id    uuid;

-- The outage instance (one per "kiosk is down" event).
create table if not exists public.kiosk_outages (
  id           uuid primary key default gen_random_uuid(),
  code         text,                        -- generated on approval, shown to the guard
  status       text not null default 'pending'
               check (status in ('pending', 'active', 'closed', 'expired', 'rejected')),
  punch_kind   text not null default 'in' check (punch_kind in ('in', 'out')),
  reason       text,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by  uuid references auth.users(id) on delete set null,
  approved_at  timestamptz,
  expires_at   timestamptz,
  reject_reason text,
  closed_by    uuid references auth.users(id) on delete set null,
  closed_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_kiosk_outages_status on public.kiosk_outages(status, created_at desc);
create unique index if not exists idx_kiosk_outages_active_code on public.kiosk_outages(code) where status = 'active';

-- Which employees are authorized for this instance, and whether they've punched.
create table if not exists public.kiosk_outage_grants (
  id          uuid primary key default gen_random_uuid(),
  outage_id   uuid not null references public.kiosk_outages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  employee_no text,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (outage_id, user_id)
);
create index if not exists idx_outage_grants_outage on public.kiosk_outage_grants(outage_id);

-- RLS: staff involved in fallback (guard + authorizers + admin) may read; all
-- writes go through service-role server actions gated by role.
alter table public.kiosk_outages       enable row level security;
alter table public.kiosk_outage_grants enable row level security;

do $$
declare t text;
begin
  foreach t in array array['kiosk_outages', 'kiosk_outage_grants'] loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format(
      'create policy %I_sel on public.%I for select to authenticated using (public.has_any_role(array[''owner'',''consultant'',''admin'',''managing_officer'',''operations_manager'',''guard'']))',
      t, t);
  end loop;
end $$;
