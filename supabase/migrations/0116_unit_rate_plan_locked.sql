-- Per-room individual lock toggle.
-- When true + master flag on + default_rate_plan_id set → cashier cannot change rate at check-in.
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS rate_plan_locked boolean NOT NULL DEFAULT false;
