-- =============================================================================
-- Migration 0094 — Hotel shift collection cutoff
--
-- Enforces the 20-minute handover window:
--   Day shift  : collection window 05:40–17:40 Manila
--   Night shift : collection window 17:40–05:40 Manila
--
-- Outgoing cashier stops counting at the cutoff; payments recorded after the
-- cutoff (during the 20-min overlap) are attributed to the INCOMING cashier.
-- The shift report stores both the window boundaries and the payment split so
-- accounting can see exactly what each cashier is responsible for.
-- =============================================================================

-- Session: store the collection window declared when the session was opened
alter table public.hotel_cashier_sessions
  add column if not exists collection_starts_at timestamptz,
  add column if not exists collection_ends_at   timestamptz;

-- Shift report: store the collection window + in-window / post-cutoff split
alter table public.hotel_shift_reports
  add column if not exists collection_starts_at       timestamptz,
  add column if not exists collection_ends_at         timestamptz,
  add column if not exists pre_cutoff_total           numeric(14,2),
  add column if not exists pre_cutoff_count           integer,
  add column if not exists post_cutoff_total          numeric(14,2),
  add column if not exists post_cutoff_count          integer,
  add column if not exists post_cutoff_payments_json  jsonb;
