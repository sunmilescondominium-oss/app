export const BUYERS_HEADERS = [
  "unit_number", "contact_label", "ref_pin", "payment_scheme",
  "payment_status", "tcp", "downpayment", "term_months", "start_date",
] as const;

/** Template CSV (header + examples + a comment on allowed values). */
export const BUYERS_TEMPLATE =
  BUYERS_HEADERS.join(",") + "\n" +
  "H-101,Buyer A,1234,fixed,current,2500000,250000,60,2026-01-01\n" +
  "H-102,Buyer B,5678,step_up,current,3200000,0,120,2026-02-15\n" +
  "# payment_scheme: step_up|fixed|balloon  ·  payment_status: current|overdue|restructured|in_dispute  ·  dates: YYYY-MM-DD\n";
