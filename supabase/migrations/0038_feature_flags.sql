-- =============================================================================
-- Migration 0038 — Feature flags (toggle whole modules on/off)
--
-- Some modules are off until the business needs them. Cash Advance ships
-- DISABLED and hidden; an admin / immediate supervisor enables it when there
-- is a need. Generic so future modules can be gated the same way.
-- =============================================================================

create table if not exists public.feature_flags (
  key             text primary key,
  label           text not null,
  enabled         boolean not null default false,
  updated_by_role text,
  updated_at      timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

-- Everyone signed in may read flags (needed to build the nav);
-- only admin / managing officer / operations manager may flip them.
drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags for select to authenticated using (true);
drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager']))
  with check (public.has_any_role(array['admin', 'managing_officer', 'operations_manager']));

insert into public.feature_flags (key, label, enabled) values
  ('cash_advance', 'Cash Advance module', false)
on conflict (key) do nothing;
