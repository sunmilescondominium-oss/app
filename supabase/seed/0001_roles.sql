-- =============================================================================
-- Seed 0001 — the 18 canonical roles (Section 3 of the build brief).
-- Idempotent: re-running refreshes labels/descriptions without duplicating.
-- NO staff names here — roles only.
-- =============================================================================

insert into public.roles (role_key, label, description, is_staff, sort_order) values
  ('owner',                  'Owner',                   'Final authority; sees the simplified Owner Dashboard only.',                                  true,   10),
  ('consultant',             'Consultant',              'Advisory only; approves broker accreditation, certifies commissions, explains computations. No operational authority.', true, 20),
  ('managing_officer',       'Managing Officer',        'Signing / admin layer; approves releases.',                                                   true,   30),
  ('operations_manager',     'Operations Manager',      'Reports to owner; receives maintenance / work-order assignments.',                             true,   40),
  ('accounting',             'Accounting',              'Back-office; confirms deposits, reconciles transmittals.',                                     true,   50),
  ('admin',                  'Admin',                   'Back-office administration.',                                                                  true,   60),
  ('hotel_rental_monitoring','Hotel & Rental Monitoring','Inputs hotel + rental / condo / parking / utility collections.',                              true,   70),
  ('hotel_cashier',          'Hotel Cashier',           'Hotel front-desk cashiering.',                                                                 true,   80),
  ('room_attendant',         'Room Attendant',          'Housekeeping.',                                                                                true,   90),
  ('guard',                  'Guard',                   'Security / access control.',                                                                   true,  100),
  ('electrician',            'Electrician',             'Executes electrical repair work orders.',                                                      true,  110),
  ('utility',                'Utility',                 'Executes general utility / maintenance work orders.',                                          true,  120),
  ('warehouse_timekeeper',   'Warehouse & Timekeeper',  'Supplies inventory; timekeeping.',                                                             true,  130),
  ('errand_liaison',         'Errand & Liaison',        'Confirms bank deposits; liaison errands.',                                                     true,  140),
  ('broker',                 'Broker',                  'External accredited broker (self-service; Phase 3 portal).',                                   false, 200),
  ('buyer',                  'Buyer',                   'External condo buyer (public PIN portal).',                                                    false, 210),
  ('tenant',                 'Tenant',                  'External rental tenant (public PIN portal).',                                                  false, 220),
  ('guest',                  'Guest',                   'External hotel / short-stay guest (public booking-ref portal).',                               false, 230)
on conflict (role_key) do update set
  label       = excluded.label,
  description = excluded.description,
  is_staff    = excluded.is_staff,
  sort_order  = excluded.sort_order;
