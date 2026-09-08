import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface ExpenseVendor {
  id: string;
  name: string;
  address: string | null;
  contact: string | null;
  tin: string | null;
  is_active: boolean;
}

export interface ExpenseSettings {
  approval_threshold: number;
  approver_roles: string[];
  petty_cash_draw_roles: string[];
}

export interface PettyCashFund {
  id: string;
  name: string;
  opening_balance: number;
  balance: number; // computed: opening + loads - disbursements
  low_balance_threshold: number;
  pcv_prefix: string;
  is_active: boolean;
}

export interface Expense {
  id: string;
  expense_date: string;
  business_line: string;
  description: string;
  amount: number;
  source: "bank" | "petty_cash" | "import";
  bank_account_id: string | null;
  bank_account_label: string | null;
  petty_cash_fund_id: string | null;
  fund_name: string | null;
  expense_category_id: string | null;
  category_name: string | null;
  expense_vendor_id: string | null;
  vendor_name: string | null;
  or_number: string | null;
  proof_url: string | null;
  approval_status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  remarks: string | null;
  created_at: string;
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("expense_categories")
    .select("id, name, description, is_active, sort_order")
    .order("sort_order", { ascending: true });
  return (data ?? []) as ExpenseCategory[];
}

export async function listExpenseVendors(): Promise<ExpenseVendor[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("expense_vendors")
    .select("id, name, address, contact, tin, is_active")
    .order("name", { ascending: true });
  return (data ?? []) as ExpenseVendor[];
}

export async function getExpenseSettings(): Promise<ExpenseSettings> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("expense_settings")
    .select("approval_threshold, approver_roles, petty_cash_draw_roles")
    .eq("id", 1)
    .maybeSingle();
  return (data ?? { approval_threshold: 5000, approver_roles: ["admin", "accounting", "managing_officer"], petty_cash_draw_roles: ["admin", "accounting"] }) as ExpenseSettings;
}

export async function listPettyCashFunds(): Promise<PettyCashFund[]> {
  const supabase = createAdminClient();
  const { data: funds } = await supabase
    .from("petty_cash_funds")
    .select("id, name, opening_balance, low_balance_threshold, pcv_prefix, is_active")
    .order("name", { ascending: true });

  if (!funds || funds.length === 0) return [];

  // Compute balance per fund from transactions
  const { data: txns } = await supabase
    .from("petty_cash_transactions")
    .select("fund_id, kind, amount");

  const balanceMap = new Map<string, number>();
  for (const f of funds) {
    balanceMap.set(f.id as string, Number(f.opening_balance ?? 0));
  }
  for (const t of txns ?? []) {
    const cur = balanceMap.get(t.fund_id as string) ?? 0;
    balanceMap.set(t.fund_id as string, cur + (t.kind === "load" ? Number(t.amount) : -Number(t.amount)));
  }

  return funds.map((f) => ({
    id: f.id as string,
    name: f.name as string,
    opening_balance: Number(f.opening_balance ?? 0),
    balance: balanceMap.get(f.id as string) ?? 0,
    low_balance_threshold: Number(f.low_balance_threshold ?? 500),
    pcv_prefix: (f.pcv_prefix as string) ?? "PCV",
    is_active: f.is_active as boolean,
  }));
}

export async function listExpenses(filters?: {
  from?: string;
  to?: string;
  source?: string;
  categoryId?: string;
  status?: string;
  limit?: number;
}): Promise<Expense[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("expenses")
    .select(`
      id, expense_date, business_line, description, amount,
      source, bank_account_id, or_number, proof_url, approval_status,
      approved_by, approved_at, remarks, created_at,
      petty_cash_fund_id, petty_cash_funds(name),
      expense_category_id, expense_categories(name),
      expense_vendor_id, expense_vendors(name),
      bank_accounts(label)
    `)
    .eq("business_line", "general")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 200);

  if (filters?.from) q = q.gte("expense_date", filters.from);
  if (filters?.to) q = q.lte("expense_date", filters.to);
  if (filters?.source) q = q.eq("source", filters.source);
  if (filters?.categoryId) q = q.eq("expense_category_id", filters.categoryId);
  if (filters?.status) q = q.eq("approval_status", filters.status);

  const { data } = await q;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    expense_date: r.expense_date as string,
    business_line: r.business_line as string,
    description: r.description as string,
    amount: Number(r.amount),
    source: r.source as Expense["source"],
    bank_account_id: (r.bank_account_id as string) ?? null,
    bank_account_label: ((r.bank_accounts as Record<string, unknown> | null)?.label as string) ?? null,
    petty_cash_fund_id: (r.petty_cash_fund_id as string) ?? null,
    fund_name: ((r.petty_cash_funds as Record<string, unknown> | null)?.name as string) ?? null,
    expense_category_id: (r.expense_category_id as string) ?? null,
    category_name: ((r.expense_categories as Record<string, unknown> | null)?.name as string) ?? null,
    expense_vendor_id: (r.expense_vendor_id as string) ?? null,
    vendor_name: ((r.expense_vendors as Record<string, unknown> | null)?.name as string) ?? null,
    or_number: (r.or_number as string) ?? null,
    proof_url: (r.proof_url as string) ?? null,
    approval_status: r.approval_status as Expense["approval_status"],
    approved_by: (r.approved_by as string) ?? null,
    approved_at: (r.approved_at as string) ?? null,
    remarks: (r.remarks as string) ?? null,
    created_at: r.created_at as string,
  }));
}

export interface CsvExpenseRow {
  expense_date: string;
  category: string;
  vendor: string;
  amount: number;
  or_number: string | null;
  source: string;
  bank_account_label: string | null;
  remarks: string | null;
}

export { CSV_TEMPLATE_FIELDS } from "./constants";
