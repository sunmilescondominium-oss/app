-- =============================================================================
-- Seed 0005 — condo buyer document-type catalog (Section 4 / M4).
-- Adding a document type later is just another row. Idempotent.
-- =============================================================================

insert into public.document_types (category, name, sort_order, milestone_gate, is_sensitive_id) values
  -- Pre-Sale
  ('Pre-Sale', 'Buyer''s Information Sheet / KYC',                    10,  null,          false),
  ('Pre-Sale', 'Government IDs (buyer + co-buyer)',                   20,  null,          true),
  ('Pre-Sale', 'Proof of Income (payslips / ITR / business permits)',30,  null,          true),
  ('Pre-Sale', 'List of Buyer Requirements',                         40,  null,          false),
  -- Sale
  ('Sale', 'Reservation Agreement (signed, date, OR#)',              110, 'reservation', false),
  ('Sale', 'Contract to Sell (exec date, notarization)',             120, 'cts',         false),
  ('Sale', 'Annex A — Schedule of Payment',                          130, 'cts',         false),
  ('Sale', 'Deed of Restrictions acknowledgment',                    140, null,          false),
  ('Sale', 'House Rules acknowledgment',                             150, null,          false),
  ('Sale', 'Master Deed & Declaration of Restrictions acknowledgment',160, null,         false),
  -- Financing (Pag-IBIG / Bank)
  ('Financing', 'MRI (policy #, premium status)',                    210, null,          false),
  ('Financing', 'Pag-IBIG Loan Application (date, status)',          220, 'loan',        false),
  ('Financing', 'TIN / payslips / ITR / employment certificate',     230, null,          true),
  ('Financing', 'Bank loan documents',                              240, null,          false),
  ('Financing', 'Loan approval / take-out confirmation',             250, 'loan',        false),
  -- Title Transfer
  ('Title Transfer', 'BIR Form 1606 / CWT (date, amount, OR#)',      310, null,          false),
  ('Title Transfer', 'CWT clearance',                                320, null,          false),
  ('Title Transfer', 'DST receipt',                                  330, null,          false),
  ('Title Transfer', 'Deed of Absolute Sale (exec, notarization)',   340, 'title',       false),
  ('Title Transfer', 'CCT (status / title #)',                       350, 'title',        false),
  ('Title Transfer', 'Transfer Tax receipt',                         360, null,          false),
  ('Title Transfer', 'Registry of Deeds filing receipt',             370, 'title',        false),
  -- Post-Sale / Compliance
  ('Post-Sale', 'Emergency Contact Form',                            410, null,          false),
  ('Post-Sale', 'Vehicle & Parking Registration',                    420, null,          false),
  ('Post-Sale', 'Move-In / Out Checklist',                           430, null,          false),
  ('Post-Sale', 'Access Card / Key Issuance Log',                    440, null,          false),
  ('Post-Sale', 'CCTV Notice acknowledgment',                        450, null,          false),
  -- Dispute / Enforcement
  ('Dispute', 'Notice of Cancellation (Maceda Law)',                 510, null,          false),
  ('Dispute', 'Notice of Refusal to Accept Payment',                 520, null,          false),
  ('Dispute', 'Demand Letter',                                       530, null,          false),
  ('Dispute', 'Change of Buyer / Assignment of Rights',              540, null,          false),
  ('Dispute', 'Document Refusal Log',                                550, null,          false),
  ('Dispute', 'Barangay Report copy',                                560, null,          false),
  ('Dispute', 'DHSUD filing / conciliation documents',               570, null,          false),
  ('Dispute', 'Legal correspondence log',                            580, null,          false)
on conflict (category, name) do update set
  sort_order      = excluded.sort_order,
  milestone_gate  = excluded.milestone_gate,
  is_sensitive_id = excluded.is_sensitive_id;
