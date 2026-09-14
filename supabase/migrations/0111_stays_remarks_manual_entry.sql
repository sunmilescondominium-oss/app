-- =============================================================================
-- Migration 0111 — stays: remarks + is_manual_entry flag
--
-- Adds two columns that the manual offline AR entry form needs:
--   remarks         — free-text context ("offline Sep 8-9, receipt #45")
--   is_manual_entry — marks stays recorded retroactively for reconciliation
-- =============================================================================

alter table public.stays
  add column if not exists remarks          text,
  add column if not exists is_manual_entry  boolean not null default false;

create index if not exists idx_stays_manual on public.stays(is_manual_entry)
  where is_manual_entry = true;
