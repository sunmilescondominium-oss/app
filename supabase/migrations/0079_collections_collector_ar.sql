-- Migration 0079: add collector_name and ar_no to collections
-- collector_name: the actual cashier's display name (not just the role key)
-- ar_no: the AR number from the physical booklet, stored alongside or_number

alter table public.collections
  add column if not exists collector_name text,
  add column if not exists ar_no          text;
