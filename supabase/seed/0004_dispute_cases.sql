-- =============================================================================
-- Seed 0004 — historical case library as institutional reference records.
-- Idempotent: reference records are refreshed each run (they are templates).
-- =============================================================================

delete from public.disputes where is_reference = true;

insert into public.disputes
  (unit_id, case_ref, issue_type, status, last_action, next_action, lawyer_notes, is_reference)
values
  ((select id from public.units where unit_number = '310' limit 1), null,
   'Unit 310 — Unauthorized occupancy', 'resolved',
   'Occupant vacated; unit secured.', 'Monitor for recurrence.',
   'Reference: eviction handled with barangay assistance.', true),

  ((select id from public.units where unit_number = '402' limit 1), null,
   'Unit 402 — CWT dispute', 'resolved',
   'CWT recomputed and filed with BIR.', 'Keep BIR acknowledgment on file.',
   'Reference: creditable withholding tax discrepancy resolved.', true),

  ((select id from public.units where unit_number = 'M26' limit 1), null,
   'Unit M26 — Penalty waiver', 'resolved',
   'Penalty waiver approved by management.', 'Document waiver in buyer folder.',
   'Reference: waiver granted per management discretion.', true),

  ((select id from public.units where unit_number = '309' limit 1), null,
   'Unit 309 — Commercial-use violation', 'resolved',
   'Cease-and-desist issued; owner complied.', 'Confirm residential use maintained.',
   'Reference: Deed of Restrictions enforced.', true),

  (null, 'RO4A-2025-0225-17289',
   'DHSUD conciliation case', 'resolved',
   'Conciliation completed at DHSUD Region IV-A.', 'Retain conciliation documents.',
   'Reference: DHSUD conciliation, case RO4A-2025-0225-17289.', true);
