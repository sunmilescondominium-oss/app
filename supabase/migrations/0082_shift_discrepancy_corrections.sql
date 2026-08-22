-- Discrepancy tracking and monitoring corrections for hotel shift reports

alter table public.hotel_shift_reports
  add column if not exists expected_collection  numeric(12,2),
  add column if not exists discrepancy_amount   numeric(12,2),
  add column if not exists discrepancy_reason   text,
  add column if not exists extension_details_json jsonb default '[]'::jsonb;

-- Per-entry corrections made by hotel_rental_monitoring after receiving the cashier bag
create table if not exists public.hotel_shift_corrections (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.hotel_shift_reports(id) on delete cascade,
  corrected_by    uuid not null references public.profiles(id),
  corrector_name  text,
  corrected_at    timestamptz not null default now(),
  payment_index   int,                              -- index into payments_json; null = new entry
  field           text not null
    check (field in ('ar_no','amount','method','guest','added','removed')),
  old_value       text,
  new_value       text not null,
  reason          text not null
);

create index if not exists hotel_shift_corrections_report
  on public.hotel_shift_corrections(report_id, corrected_at desc);

-- RLS: same access as hotel_shift_reports
alter table public.hotel_shift_corrections enable row level security;

drop policy if exists hotel_shift_corrections_sel on public.hotel_shift_corrections;
create policy hotel_shift_corrections_sel on public.hotel_shift_corrections
  for select using (true);

drop policy if exists hotel_shift_corrections_ins on public.hotel_shift_corrections;
create policy hotel_shift_corrections_ins on public.hotel_shift_corrections
  for insert with check (auth.uid() = corrected_by);
