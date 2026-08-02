export interface EmployeeRow {
  id: string;
  label: string;
  email: string | null;
  roleKeys: string[];
  photoPath: string | null;
  active: boolean;
  dailyRate: number;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  decided_at: string | null;
  decision_note: string | null;
  /** Filled in for HR views (never for self views). */
  label?: string;
}
