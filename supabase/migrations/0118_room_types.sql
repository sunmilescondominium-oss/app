-- Room types: group rate plans by room type so check-in only shows the
-- 3 duration options for the room being checked into.

CREATE TABLE room_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0
);

ALTER TABLE rate_plans ADD COLUMN room_type_id uuid REFERENCES room_types(id) ON DELETE SET NULL;
ALTER TABLE units      ADD COLUMN room_type_id uuid REFERENCES room_types(id) ON DELETE SET NULL;

-- Seed the 4 room types and link existing rate plans by name prefix.
DO $$
DECLARE
  rt_standard uuid;
  rt_deluxe   uuid;
  rt_family   uuid;
  rt_suite    uuid;
BEGIN
  INSERT INTO room_types (name, sort_order) VALUES ('Standard with Fan',                       10) RETURNING id INTO rt_standard;
  INSERT INTO room_types (name, sort_order) VALUES ('Deluxe w/ Aircon & TV',                   20) RETURNING id INTO rt_deluxe;
  INSERT INTO room_types (name, sort_order) VALUES ('Family Room w/ Garage, Aircon & TV',      30) RETURNING id INTO rt_family;
  INSERT INTO room_types (name, sort_order) VALUES ('Suite w/ Garage, Aircon & TV',            40) RETURNING id INTO rt_suite;

  UPDATE rate_plans SET room_type_id = rt_standard WHERE name LIKE 'Standard with Fan%';
  UPDATE rate_plans SET room_type_id = rt_deluxe   WHERE name LIKE 'Deluxe w/ Aircon & TV%';
  UPDATE rate_plans SET room_type_id = rt_family   WHERE name LIKE 'Family Room w/ Garage, Aircon & TV%';
  UPDATE rate_plans SET room_type_id = rt_suite    WHERE name LIKE 'Suite w/ Garage, Aircon & TV%';
END $$;
