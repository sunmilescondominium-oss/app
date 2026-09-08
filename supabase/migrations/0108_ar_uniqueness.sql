-- =============================================================================
-- 0108 · AR number uniqueness enforcement for stay_payments
-- =============================================================================
-- Prevents the same AR number from being recorded on two different payments.
-- Uses a partial unique index (WHERE ar_no IS NOT NULL) so blank/null AR slots
-- remain unrestricted (some legacy rows have null ar_no).
--
-- NOTE: If existing data contains duplicate ar_no values this statement will
-- fail. Run the query below first to check, and correct any duplicates via
-- the hotel_ar_edits flow before applying:
--
--   SELECT ar_no, count(*) FROM stay_payments
--   WHERE ar_no IS NOT NULL
--   GROUP BY ar_no HAVING count(*) > 1;

create unique index if not exists idx_stay_payments_ar_no_unique
  on public.stay_payments (ar_no)
  where ar_no is not null;
