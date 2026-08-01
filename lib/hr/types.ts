export interface TimeRecord {
  id: string;
  user_id: string;
  work_date: string;
  time_in: string | null;
  time_in_photo: string | null;
  time_out: string | null;
  time_out_photo: string | null;
  hours: number | null;
  note: string | null;
}

/** A staff member's payroll totals over a period (PH daily-rate basis). */
export interface DtrRow {
  userId: string;
  label: string;
  dailyRate: number;
  daysPresent: number;
  halfDays: number;
  lateDays: number;
  lateMinutes: number;
  undertimeMinutes: number;
  regularHours: number;
  otHours: number;
  nightHours: number;
  basicPay: number;
  otPay: number;
  nightPay: number;
  deductions: number;
  netPay: number;
}

export interface PayrollReport {
  from: string;
  to: string;
  rows: DtrRow[];
  netTotal: number;
  basicTotal: number;
  otTotal: number;
  nightTotal: number;
  deductionTotal: number;
}

export interface StaffPay {
  user_id: string;
  daily_rate: number;
}
