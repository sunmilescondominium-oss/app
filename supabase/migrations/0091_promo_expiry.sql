-- Add validity date range to promos
alter table public.promos
  add column if not exists valid_from  date default null,
  add column if not exists valid_until date default null;
