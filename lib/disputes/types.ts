export interface Dispute {
  id: string;
  unit_id: string | null;
  buyer_id: string | null;
  case_ref: string | null;
  issue_type: string;
  status: string;
  last_action: string | null;
  next_action: string | null;
  target_date: string | null;
  /** null when the viewer is not a consultant (stripped server-side). */
  lawyer_notes: string | null;
  is_reference: boolean;
  created_at: string;
  unit?: { unit_number: string } | null;
}
