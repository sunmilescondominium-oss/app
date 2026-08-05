-- =============================================================================
-- Migration 0049 — Internal (non-BIR) accountable forms + petty cash vouchers.
--
-- Some accountable forms are internal only (e.g. internal collection receipts,
-- petty cash vouchers) and are NOT reported to the BIR. Add a per-type toggle;
-- BIR business/ATP details only matter when a type is BIR-reportable.
-- =============================================================================

alter table public.form_types add column if not exists bir_reportable boolean not null default true;

-- Gate pass is internal; add petty cash voucher + internal collection receipt.
update public.form_types set bir_reportable = false where code in ('GP');

insert into public.form_types (code, name, bir_reportable, sort_order) values
  ('PCV', 'Petty Cash Voucher', false, 80),
  ('ICR', 'Internal Collection Receipt', false, 90),
  ('CV',  'Cash / Disbursement Voucher', false, 100)
on conflict (code) do nothing;
