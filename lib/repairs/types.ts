export interface RepairRequest {
  id: string;
  ticket_ref: string;
  unit_id: string | null;
  requester_type: string;
  requester_ref: string | null;
  requester_contact: string | null;
  issue_type: string;
  description: string;
  urgency: string;
  photo_path: string | null;
  status: string;
  assigned_to_role: string | null;
  created_at: string;
  updated_at: string;
  unit?: { unit_number: string; property_name?: string } | null;
}
