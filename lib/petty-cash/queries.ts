import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PettyCashFund {
  id: string;
  name: string;
  custodian_user_id: string | null;
  custodian_name: string | null;
  low_balance_threshold: number;
  pcv_prefix: string;
  pcv_sequence: number;
  is_active: boolean;
  balance: number;
}

export interface PettyCashTransaction {
  id: string;
  fund_id: string;
  kind: "load" | "disbursement";
  amount: number;
  pcv_no: string | null;
  bank_account_id: string | null;
  bank_account_label: string | null;
  expense_id: string | null;
  description: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
}

export async function listPettyCashFunds(): Promise<PettyCashFund[]> {
  const supabase = createAdminClient();

  const [{ data: funds }, { data: txns }] = await Promise.all([
    supabase.from("petty_cash_funds").select("*, profiles(full_name)").eq("is_active", true).order("name"),
    supabase.from("petty_cash_transactions").select("fund_id, kind, amount"),
  ]);

  const balanceByFund = new Map<string, number>();
  for (const t of txns ?? []) {
    const row = t as Record<string, unknown>;
    const prev = balanceByFund.get(row.fund_id as string) ?? 0;
    const delta = row.kind === "load" ? Number(row.amount) : -Number(row.amount);
    balanceByFund.set(row.fund_id as string, prev + delta);
  }

  return (funds ?? []).map((f: Record<string, unknown>) => ({
    id: f.id as string,
    name: f.name as string,
    custodian_user_id: (f.custodian_user_id as string) ?? null,
    custodian_name: ((f.profiles as Record<string, unknown> | null)?.full_name as string) ?? null,
    low_balance_threshold: Number(f.low_balance_threshold),
    pcv_prefix: f.pcv_prefix as string,
    pcv_sequence: Number(f.pcv_sequence),
    is_active: f.is_active as boolean,
    balance: balanceByFund.get(f.id as string) ?? 0,
  }));
}

export async function listPettyCashTransactions(fundId: string, limit = 100): Promise<PettyCashTransaction[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("petty_cash_transactions")
    .select("*, bank_accounts(label)")
    .eq("fund_id", fundId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    fund_id: r.fund_id as string,
    kind: r.kind as PettyCashTransaction["kind"],
    amount: Number(r.amount),
    pcv_no: (r.pcv_no as string) ?? null,
    bank_account_id: (r.bank_account_id as string) ?? null,
    bank_account_label: ((r.bank_accounts as Record<string, unknown> | null)?.label as string) ?? null,
    expense_id: (r.expense_id as string) ?? null,
    description: (r.description as string) ?? null,
    receipt_url: (r.receipt_url as string) ?? null,
    created_by: (r.created_by as string) ?? null,
    created_at: r.created_at as string,
  }));
}
