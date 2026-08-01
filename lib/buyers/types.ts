import type { SOAResult } from "@/lib/computation/types";

export interface Buyer {
  id: string;
  unit_id: string | null;
  contact_label: string;
  ref_pin: string;
  payment_scheme: string;
  payment_status: string;
  tcp: number | null;
  downpayment: number;
  term_months: number;
  annual_interest_rate: number | null;
  start_date: string;
  is_active: boolean;
  created_at: string;
  unit?: { unit_number: string; property_name?: string; tcp?: number | null } | null;
}

export interface BuyerListItem extends Buyer {
  contract_balance: number | null;
  next_due_date: string | null;
}

export interface Payment {
  id: string;
  buyer_id: string;
  doc_type: string;
  or_number: string | null;
  amount: number;
  paid_on: string;
  remarks: string | null;
  created_at: string;
}

export interface BuyerDetail {
  buyer: Buyer;
  payments: Payment[];
  soa: SOAResult | null;
  soaMeta: { created_at: string; source: string; params_version: number | null } | null;
}

export interface ComputationParam {
  id: string;
  key: string;
  value: number;
  label: string | null;
  params_version: number;
  is_active: boolean;
}
