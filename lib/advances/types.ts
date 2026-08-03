export interface CashAdvance {
  id: string;
  user_id: string;
  label?: string;
  amount: number;
  purpose: string;
  needed_by: string | null;
  status: string;
  decision_note: string | null;
  released_on: string | null;
  liquidated_total: number | null;
  liquidated_on: string | null;
  created_at: string;
}

export interface Liquidation {
  id: string;
  description: string;
  amount: number;
  spent_on: string;
}
