-- Assign a default (locked) rate plan to a hotel room.
-- When set, the check-in form pre-selects this plan and the cashier cannot change it.
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS default_rate_plan_id uuid
    REFERENCES rate_plans(id) ON DELETE SET NULL;
