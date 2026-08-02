export interface EmployeeRow {
  id: string;
  label: string;
  email: string | null;
  roleKeys: string[];
  photoPath: string | null;
  active: boolean;
  dailyRate: number;
  employeeNo: string | null;
  hasPasscode: boolean;
  qrToken: string | null;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  category: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  hours: number | null;
  reason: string | null;
  status: string;
  decided_at: string | null;
  decision_note: string | null;
  /** Filled in for HR views (never for self views). */
  label?: string;
}
