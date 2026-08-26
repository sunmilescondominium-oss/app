-- =============================================================================
-- Migration 0088 — Ghost demo rooms
--
-- 1. units.is_demo     — marks ghost rooms that only appear during demo mode.
--    Real rooms are never shown to demo users; demo rooms are never shown to
--    real-session users. This keeps demo activity completely isolated.
-- 2. Seed 3 ghost demo rooms under the first property.
-- =============================================================================

alter table public.units
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_units_is_demo on public.units(is_demo);

-- Seed 3 ghost demo rooms under the first hotel property.
-- ON CONFLICT DO NOTHING makes this idempotent.
do $$
declare
  v_property_id uuid;
begin
  select id into v_property_id from public.properties limit 1;
  if v_property_id is not null then
    insert into public.units (property_id, unit_number, unit_type, business_line, is_demo, is_active, status)
    values
      (v_property_id, 'DEMO-101', 'standard', 'hotel', true, true, 'available'),
      (v_property_id, 'DEMO-201', 'deluxe',   'hotel', true, true, 'available'),
      (v_property_id, 'DEMO-301', 'suite',    'hotel', true, true, 'available')
    on conflict (property_id, unit_number) do nothing;
  end if;
end $$;
