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

/** A staff member's DTR total over a period (aggregated for HR). */
export interface DtrRow {
  userId: string;
  label: string;
  days: number;
  hours: number;
  hourlyRate: number;
  gross: number;
}

export interface PayrollReport {
  from: string;
  to: string;
  rows: DtrRow[];
  hoursTotal: number;
  grossTotal: number;
}

export interface StaffPay {
  user_id: string;
  hourly_rate: number;
}
