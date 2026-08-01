-- =============================================================================
-- Seed 0003 — default computation parameters (editable by admin/consultant).
-- `on conflict do nothing` so re-seeding never overwrites edited values.
-- TODO(client-confirm): confirm the real rates, penalty %, and scheme terms.
-- =============================================================================

insert into public.computation_params (key, value, label) values
  ('params_version',        1,      'Parameter set version'),
  ('annual_interest_rate',  0.1000, 'Annual interest rate'),
  ('penalty_monthly_rate',  0.0200, 'Monthly penalty rate (Civil Code Art. 1253)'),
  ('default_term_months',   60,     'Default term (months)'),
  ('grace_days',            15,     'Grace days before penalty'),
  ('stepup_increment_rate', 0.0500, 'Step-up increment per period'),
  ('stepup_period_months',  12,     'Step-up period (months)'),
  ('balloon_percent',       0.2000, 'Balloon amount (fraction of principal)')
on conflict (key) do nothing;
