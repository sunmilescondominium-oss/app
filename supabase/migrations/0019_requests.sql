-- =============================================================================
-- Migration 0019 — Broaden employee requests (overtime / undertime / other)
--
-- The leave_requests table becomes the single "employee requests" table. New
-- categories reuse the same approval workflow; `hours` holds OT/UT duration.
-- =============================================================================

alter table public.leave_requests add column if not exists hours numeric(5, 2);

alter table public.leave_requests drop constraint if exists leave_requests_category_check;
alter table public.leave_requests
  add constraint leave_requests_category_check
  check (category in ('leave', 'ob', 'overtime', 'undertime', 'other'));
