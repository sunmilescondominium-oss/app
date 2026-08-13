-- Add SI (Sales Invoice) as a valid accountable form type.
-- Must drop and recreate the check constraint to extend the allowed values.
alter table public.collections
  drop constraint if exists collections_receipt_type_check;

alter table public.collections
  add constraint collections_receipt_type_check
    check (receipt_type in ('OR', 'AR', 'PR', 'SI'));

-- Track when a PR was cleared to OR/SI (cleared_at + cleared_by_role).
alter table public.collections
  add column if not exists cleared_at     timestamptz,
  add column if not exists cleared_by_role text;
