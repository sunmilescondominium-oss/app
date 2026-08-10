export type AuthRequestType = "collection_edit" | "transmittal_revert";
export type AuthRequestStatus = "pending" | "approved" | "rejected" | "expired";

export interface AuthRequest {
  id: string;
  type: AuthRequestType;
  entity_id: string;
  requested_by: string | null;
  requester_role: string | null;
  requester_label: string;
  justification: string;
  payload: Record<string, unknown>;
  status: AuthRequestStatus;
  reviewed_by: string | null;
  reviewer_role: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  expires_at: string;
  created_at: string;
}
