-- Track the accountable form type (OR/AR/PR) and postdated check details
-- for collections. receipt_type defaults to null (legacy rows kept as-is).
alter table public.collections
  add column if not exists receipt_type text
    check (receipt_type in ('OR', 'AR', 'PR')),
  add column if not exists check_number text,
  add column if not exists check_date    date,
  add column if not exists check_bank    text;

-- Index for finding checks coming due (for deposit notification).
create index if not exists collections_check_date_idx
  on public.collections(check_date)
  where check_date is not null;
