-- 0113 — Transmittal "return for correction" workflow
--
-- Accounting / admin can send a deposited transmittal back to the liaison
-- officer who encoded it, requiring them to correct the entry with a reason.
-- The return is tracked on the transmittal itself so the liaison sees the
-- correction request. The corrected custody step creates a new row in
-- transmittal_custody (audit trail preserves both the original and the fix).
-- correction_note is added to transmittal_custody so the correcting actor
-- must explain what changed.

alter table public.transmittals
  add column if not exists returned_at       timestamptz,
  add column if not exists returned_by       uuid references auth.users(id) on delete set null,
  add column if not exists returned_by_role  text,
  add column if not exists return_reason     text;

alter table public.transmittal_custody
  add column if not exists correction_note  text;
