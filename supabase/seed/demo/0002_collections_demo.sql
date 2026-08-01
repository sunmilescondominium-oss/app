-- =============================================================================
-- DEMO DATA — sample collections dated TODAY (Manila) so the Collections
-- dashboard shows data on first load. Idempotent (removes prior un-transmitted
-- demo rows by OR number, then re-inserts). Run with `npm run seed:demo`.
-- =============================================================================

delete from public.collections
where or_number in ('OR-1001', 'OR-1002', 'OR-1003', 'OR-1004', 'OR-1005', 'OR-1006')
  and transmittal_id is null;

insert into public.collections
  (business_line, unit_id, amount, or_number, payment_type, collected_by_role, collected_on, remarks)
values
  ('hotel',       (select id from public.units where unit_number = 'Suite-201' limit 1), 4500.00,  'OR-1001', 'cash',          'hotel_cashier',           (now() at time zone 'Asia/Manila')::date, 'Suite - 2 nights'),
  ('rental',      (select id from public.units where unit_number = 'H03' limit 1),        12000.00, 'OR-1002', 'gcash',         'hotel_rental_monitoring', (now() at time zone 'Asia/Manila')::date, 'Monthly rent'),
  ('rental',      (select id from public.units where unit_number = 'H06' limit 1),        12000.00, 'OR-1003', 'cash',          'hotel_rental_monitoring', (now() at time zone 'Asia/Manila')::date, 'Monthly rent'),
  ('parking',     null,                                                                    1500.00,  'OR-1004', 'cash',          'guard',                   (now() at time zone 'Asia/Manila')::date, 'Visitor parking'),
  ('utility',     null,                                                                    800.00,   'OR-1005', 'cash',          'utility',                 (now() at time zone 'Asia/Manila')::date, 'Water refill'),
  ('condo_sales', (select id from public.units where unit_number = '5B' limit 1),          50000.00, 'OR-1006', 'bank_transfer', 'accounting',              (now() at time zone 'Asia/Manila')::date, 'Reservation fee');
