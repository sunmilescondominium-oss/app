-- Meralco CAN and water service account numbers stored per unit.
-- Each room/unit has its own consumer account number.
alter table public.units
  add column if not exists meralco_can      text,
  add column if not exists water_account_no text;

-- Extended billing detail on every meter reading entry.
-- bill_amount  : actual peso amount from the Meralco/Water bill
-- billing_period: 'YYYY-MM' billing month the reading covers
-- or_number    : Meralco OR / bill reference number
-- due_date     : when the bill is due for payment
alter table public.meter_readings
  add column if not exists bill_amount    numeric(10,2),
  add column if not exists billing_period text,
  add column if not exists or_number      text,
  add column if not exists due_date       date;
