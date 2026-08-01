-- =============================================================================
-- Migration 0003 — Custom fields (dynamically scalable unit attributes)
--
-- Answers "what if we need more fields later": an admin adds a field DEFINITION
-- (one row) and it appears on the unit form — no migration, no deploy.
-- Values are stored per-unit in units.custom_fields (jsonb).
--
-- Idempotent.
-- =============================================================================

create table if not exists public.unit_field_definitions (
  id            uuid primary key default gen_random_uuid(),
  business_line text check (business_line is null
                            or business_line in ('condo_sales', 'rental', 'hotel', 'airbnb')),
                            -- null = applies to every business line
  key           text not null,
  label         text not null,
  data_type     text not null default 'text'
                check (data_type in ('text', 'number', 'date', 'select', 'boolean')),
  options       jsonb not null default '[]'::jsonb,  -- for data_type = 'select'
  is_required   boolean not null default false,
  sort_order    integer not null default 100,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- PG15+: treat NULL business_line as a real value so (null,'tower') is unique.
  unique nulls not distinct (business_line, key)
);

drop trigger if exists trg_ufd_updated_at on public.unit_field_definitions;
create trigger trg_ufd_updated_at
  before update on public.unit_field_definitions
  for each row execute function public.set_updated_at();

-- Per-unit values for the custom fields above.
alter table public.units
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- RLS: read = all staff · write (manage field catalog) = admin, managing_officer
-- ---------------------------------------------------------------------------
alter table public.unit_field_definitions enable row level security;

drop policy if exists ufd_select_staff on public.unit_field_definitions;
create policy ufd_select_staff
  on public.unit_field_definitions for select to authenticated
  using (public.is_staff());

drop policy if exists ufd_write on public.unit_field_definitions;
create policy ufd_write
  on public.unit_field_definitions for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer']))
  with check (public.has_any_role(array['admin', 'managing_officer']));
