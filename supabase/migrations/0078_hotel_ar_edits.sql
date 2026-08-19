-- =============================================================================
-- Migration 0078 — Hotel AR/OR edits + short-stay flags
--
-- Adds:
--   stays.voided_as_test     — cashier-flagged test check-ins (< 30 min)
--   stays.short_stay_reason  — mandatory reason for real early checkouts (< 30 min)
--   hotel_ar_edits           — audit log when accounting corrects AR/OR assignments
-- =============================================================================

alter table public.stays
  add column if not exists voided_as_test    boolean not null default false,
  add column if not exists short_stay_reason text;

create table if not exists public.hotel_ar_edits (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references public.stay_payments(id) on delete cascade,
  old_ar_no   text,
  new_ar_no   text,
  old_or_no   text,
  new_or_no   text,
  reason      text not null,
  edited_by   uuid not null references auth.users(id) on delete restrict,
  edited_at   timestamptz not null default now()
);

create index if not exists idx_ar_edits_payment
  on public.hotel_ar_edits(payment_id, edited_at desc);

create index if not exists idx_ar_edits_edited
  on public.hotel_ar_edits(edited_at desc);

alter table public.hotel_ar_edits enable row level security;

create policy hotel_ar_edits_read on public.hotel_ar_edits
  for select to authenticated
  using (public.has_any_role(array[
    'admin','managing_officer','accounting','hotel_rental_monitoring','consultant'
  ]));

create policy hotel_ar_edits_write on public.hotel_ar_edits
  for insert to authenticated
  with check (public.has_any_role(array[
    'admin','managing_officer','accounting','consultant'
  ]));
