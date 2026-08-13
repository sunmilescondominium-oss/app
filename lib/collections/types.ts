export interface Collection {
  id: string;
  business_line: string;
  unit_id: string | null;
  charge_type: string | null;
  amount: number;
  or_number: string | null;
  receipt_type: string | null;
  check_number: string | null;
  check_date: string | null;
  check_bank: string | null;
  payment_type: string;
  collected_by_role: string | null;
  collected_on: string;
  transmittal_id: string | null;
  remarks: string | null;
  created_at: string;
  unit?: { unit_number: string; property_name?: string } | null;
}

export interface DailySummaryRow {
  category: string;
  label: string;
  count: number;
  total: number;
}

export interface DailySummary {
  date: string;
  rows: DailySummaryRow[];
  grandTotal: number;
  count: number;
}

export interface Transmittal {
  id: string;
  business_line: string | null;
  transmittal_date: string;
  total_amount: number;
  counted_cash: number | null;
  denomination_counts: Record<string, number> | null;
  counted_by_role: string | null;
  confirmed_by_role: string | null;
  reconciled_by_role: string | null;
  deposit_slip_ref: string | null;
  deposited_amount: number | null;
  passbook_returned_on: string | null;
  passbook_returned_by_role: string | null;
  status: string;
  custody_stage: string;
  notes: string | null;
  printed_at: string | null;
  created_at: string;
}

export interface TransmittalDetail extends Transmittal {
  collections: Collection[];
}

export interface UnitOption {
  id: string;
  label: string;
}
