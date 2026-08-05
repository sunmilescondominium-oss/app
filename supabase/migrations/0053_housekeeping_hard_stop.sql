-- 0053_housekeeping_hard_stop.sql
-- Toggle: block "Mark room ready" until the checklist is complete AND the
-- standard room materials are recorded. ON by default (hard stop). Admin,
-- operations, and hotel & rental monitoring can flip it.

insert into public.feature_flags (key, label, enabled) values
  ('housekeeping_hard_stop', 'Housekeeping — block Mark room ready until complete', true)
on conflict (key) do nothing;

-- Widen the feature-flags write policy so hotel & rental monitoring can flip
-- housekeeping-scoped flags too (they already own the default-items setup).
drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'hotel_rental_monitoring']))
  with check (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'hotel_rental_monitoring']));
