-- =============================================================================
-- DEMO DATA — inventory across all four business lines. For demos only; NOT run
-- by the default `npm run seed`. Run with `npm run seed:demo`. Idempotent.
-- =============================================================================

insert into public.properties (name, address) values
  ('Sun Residences',     'Calamba City, Laguna'),
  ('Block H',            'Calamba City, Laguna'),
  ('SMiles Hotel',       'Calamba City, Laguna'),
  ('SMiles Airbnb Pool', 'Calamba City, Laguna')
on conflict (name) do update set address = excluded.address, is_active = true;

-- ---- Condo sales (with Tower / Facing / Turnover custom fields) -----------
insert into public.units
  (property_id, unit_number, unit_type, floor, area_sqm, business_line, tcp, status, custom_fields)
values
  ((select id from public.properties where name='Sun Residences'),'5A','Studio','5',20.40,'condo_sales',2500000,'available','{"tower":"Tower A","facing":"North","turnover_date":"2026-12-15"}'::jsonb),
  ((select id from public.properties where name='Sun Residences'),'5B','1BR','5',28.50,'condo_sales',3250000,'reserved','{"tower":"Tower A","facing":"East","turnover_date":"2026-12-15"}'::jsonb),
  ((select id from public.properties where name='Sun Residences'),'8C','2BR','8',45.00,'condo_sales',4850000,'available','{"tower":"Tower A","facing":"South","turnover_date":"2027-03-30"}'::jsonb),
  ((select id from public.properties where name='Sun Residences'),'12D','3BR Loft','12',57.28,'condo_sales',8100000,'reserved','{"tower":"Tower B","facing":"West","turnover_date":"2027-06-30"}'::jsonb),
  ((select id from public.properties where name='Sun Residences'),'3A','Studio','3',18.50,'condo_sales',2400000,'available','{"tower":"Tower B","facing":"North"}'::jsonb),
  ((select id from public.properties where name='Sun Residences'),'15E','2BR','15',46.20,'condo_sales',5000000,'blocked','{"tower":"Tower B","facing":"South-East"}'::jsonb)
on conflict (property_id, unit_number) do update set
  unit_type=excluded.unit_type, floor=excluded.floor, area_sqm=excluded.area_sqm,
  business_line=excluded.business_line, tcp=excluded.tcp, status=excluded.status,
  custom_fields=excluded.custom_fields;

-- ---- Residential rentals: Block H, H01–H18 -------------------------------
insert into public.units (property_id, unit_number, unit_type, floor, area_sqm, business_line, status)
select p.id,
       'H' || lpad(g::text, 2, '0'),
       '1BR',
       (((g - 1) / 6) + 1)::text,
       24.50,
       'rental',
       case when g % 5 = 0 then 'under_maintenance'
            when g % 3 = 0 then 'occupied'
            else 'available' end
from public.properties p
cross join generate_series(1, 18) as g
where p.name = 'Block H'
on conflict (property_id, unit_number) do update set
  unit_type=excluded.unit_type, floor=excluded.floor, area_sqm=excluded.area_sqm,
  business_line=excluded.business_line, status=excluded.status;

-- ---- Hotel / short-stay rooms --------------------------------------------
insert into public.units (property_id, unit_number, unit_type, floor, area_sqm, business_line, status)
values
  ((select id from public.properties where name='SMiles Hotel'),'Family-101','Family','1',32.00,'hotel','available'),
  ((select id from public.properties where name='SMiles Hotel'),'Suite-201','Suite','2',40.00,'hotel','occupied'),
  ((select id from public.properties where name='SMiles Hotel'),'Deluxe-202','Deluxe','2',26.00,'hotel','available'),
  ((select id from public.properties where name='SMiles Hotel'),'Standard-301','Standard','3',20.00,'hotel','available'),
  ((select id from public.properties where name='SMiles Hotel'),'Standard-302','Standard','3',20.00,'hotel','under_maintenance')
on conflict (property_id, unit_number) do update set
  unit_type=excluded.unit_type, floor=excluded.floor, area_sqm=excluded.area_sqm,
  business_line=excluded.business_line, status=excluded.status;

-- ---- Airbnb pool ----------------------------------------------------------
insert into public.units (property_id, unit_number, unit_type, floor, area_sqm, business_line, status)
values
  ((select id from public.properties where name='SMiles Airbnb Pool'),'ABNB-01','1BR','7',30.00,'airbnb','available'),
  ((select id from public.properties where name='SMiles Airbnb Pool'),'ABNB-02','Studio','9',22.00,'airbnb','occupied')
on conflict (property_id, unit_number) do update set
  unit_type=excluded.unit_type, floor=excluded.floor, area_sqm=excluded.area_sqm,
  business_line=excluded.business_line, status=excluded.status;
