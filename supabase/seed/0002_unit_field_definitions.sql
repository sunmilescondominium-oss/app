-- =============================================================================
-- Seed 0002 — starter custom-field definitions.
-- These are CONFIG (not demo data): condo units get Tower/Building, Facing,
-- Turnover date out of the box. Admins can add more from the UI with no deploy.
-- Idempotent.
-- =============================================================================

insert into public.unit_field_definitions
  (business_line, key, label, data_type, options, is_required, sort_order)
values
  ('condo_sales', 'tower', 'Tower / Building', 'text', '[]'::jsonb, false, 10),
  ('condo_sales', 'facing', 'Facing', 'select',
    '["North","South","East","West","North-East","North-West","South-East","South-West"]'::jsonb,
    false, 20),
  ('condo_sales', 'turnover_date', 'Turnover date', 'date', '[]'::jsonb, false, 30)
on conflict (business_line, key) do update set
  label       = excluded.label,
  data_type   = excluded.data_type,
  options     = excluded.options,
  is_required = excluded.is_required,
  sort_order  = excluded.sort_order;
