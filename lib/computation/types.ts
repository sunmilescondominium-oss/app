export type ParamMap = Record<string, number>;

export interface SOAInput {
  scheme: "fixed" | "step_up" | "balloon";
  tcp: number;
  downpayment: number;
  term_months: number;
  annual_interest_rate: number | null; // null = use computation_params default
  start_date: string; // YYYY-MM-DD
  asOf: string; // YYYY-MM-DD (today, for overdue / penalty)
  payments: { amount: number; paid_on: string }[];
}

export interface ScheduleRow {
  n: number;
  due_date: string;
  scheduled_payment: number;
  interest: number;
  principal: number;
  balance_after: number;
  status: "paid" | "partial" | "due" | "upcoming";
  paid_applied: number;
  penalty: number;
}

export interface SOAResult {
  source: "local" | "n8n";
  params_version: number;
  scheme: string;
  principal: number;
  term_months: number;
  monthly_rate: number;
  schedule: ScheduleRow[];
  totals: {
    scheduled_total: number;
    total_paid: number;
    total_penalty: number;
    principal_paid: number;
    contract_balance: number;
    amount_due_now: number;
  };
  next_due_date: string | null;
  generated_at: string;
}
