-- Feature flag: when enabled, rooms with a default_rate_plan_id lock the cashier
-- to that plan at check-in. Default OFF so admin can configure rooms safely first.
INSERT INTO public.feature_flags (key, label, enabled, updated_at)
VALUES ('hotel_rate_plan_lock', 'Hotel Room Rate Plan Lock', false, now())
ON CONFLICT (key) DO NOTHING;
