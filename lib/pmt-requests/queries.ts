import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PmtRequestStatus = "pending" | "submitted" | "approved" | "rejected" | "released";
export type SourceType = "bank" | "petty_cash";

export interface PmtRequest {
  id: string;
  link_token: string;
  created_by: string;
  creator_name: string;
  requestor_user_id: string;
  requestor_name: string;
  requestor_employee_no: string | null;
  expires_at: string;
  payee_name: string | null;
  purpose: string | null;
  payment_type: "check" | "petty_cash" | null;
  primary_source_type: SourceType | null;
  primary_source_id: string | null;
  primary_source_amount: number | null;
  secondary_source_type: SourceType | null;
  secondary_source_id: string | null;
  secondary_source_amount: number | null;
  description: string | null;
  amount_requested: number | null;
  supporting_doc_url: string | null;
  submitted_at: string | null;
  status: PmtRequestStatus;
  approval_note: string | null;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  budget_released_at: string | null;
  expense_id: string | null;
  created_at: string;
}

export interface SourceOption {
  id: string;
  label: string;
  type: SourceType;
  balance: number;
}

export async function listPmtRequests(): Promise<PmtRequest[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pmt_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (!data) return [];

  // Fetch requestor and creator profiles in batch
  const userIds = [...new Set([...data.map((r) => r.requestor_user_id), ...data.map((r) => r.created_by)])];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, employee_no")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return data.map((r) => {
    const req = profileMap.get(r.requestor_user_id as string);
    const cre = profileMap.get(r.created_by as string);
    return {
      id: r.id as string,
      link_token: r.link_token as string,
      created_by: r.created_by as string,
      creator_name: (cre?.full_name as string) ?? "Accounting",
      requestor_user_id: r.requestor_user_id as string,
      requestor_name: (req?.full_name as string) ?? "Unknown",
      requestor_employee_no: (req?.employee_no as string | null) ?? null,
      expires_at: r.expires_at as string,
      payee_name: (r.payee_name as string | null) ?? null,
      purpose: (r.purpose as string | null) ?? null,
      payment_type: (r.payment_type as "check" | "petty_cash" | null) ?? null,
      primary_source_type: (r.primary_source_type as SourceType | null) ?? null,
      primary_source_id: (r.primary_source_id as string | null) ?? null,
      primary_source_amount: r.primary_source_amount ? Number(r.primary_source_amount) : null,
      secondary_source_type: (r.secondary_source_type as SourceType | null) ?? null,
      secondary_source_id: (r.secondary_source_id as string | null) ?? null,
      secondary_source_amount: r.secondary_source_amount ? Number(r.secondary_source_amount) : null,
      description: (r.description as string | null) ?? null,
      amount_requested: r.amount_requested ? Number(r.amount_requested) : null,
      supporting_doc_url: (r.supporting_doc_url as string | null) ?? null,
      submitted_at: (r.submitted_at as string | null) ?? null,
      status: r.status as PmtRequestStatus,
      approval_note: (r.approval_note as string | null) ?? null,
      rejection_reason: (r.rejection_reason as string | null) ?? null,
      approved_by: (r.approved_by as string | null) ?? null,
      approved_at: (r.approved_at as string | null) ?? null,
      budget_released_at: (r.budget_released_at as string | null) ?? null,
      expense_id: (r.expense_id as string | null) ?? null,
      created_at: r.created_at as string,
    };
  });
}

export async function getPmtRequestByToken(token: string): Promise<{
  request: PmtRequest;
  passcode_hash: string;
  employee_no: string;
} | null> {
  const admin = createAdminClient();
  const { data: r } = await admin
    .from("pmt_requests")
    .select("*")
    .eq("link_token", token)
    .maybeSingle();

  if (!r) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, employee_no, passcode_hash")
    .eq("id", r.requestor_user_id as string)
    .maybeSingle();

  if (!profile?.passcode_hash || !profile?.employee_no) return null;

  const { data: creator } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", r.created_by as string)
    .maybeSingle();

  const request: PmtRequest = {
    id: r.id as string,
    link_token: r.link_token as string,
    created_by: r.created_by as string,
    creator_name: (creator?.full_name as string) ?? "Accounting",
    requestor_user_id: r.requestor_user_id as string,
    requestor_name: (profile.full_name as string) ?? "Unknown",
    requestor_employee_no: (profile.employee_no as string | null) ?? null,
    expires_at: r.expires_at as string,
    payee_name: (r.payee_name as string | null) ?? null,
    purpose: (r.purpose as string | null) ?? null,
    payment_type: (r.payment_type as "check" | "petty_cash" | null) ?? null,
    primary_source_type: (r.primary_source_type as SourceType | null) ?? null,
    primary_source_id: (r.primary_source_id as string | null) ?? null,
    primary_source_amount: r.primary_source_amount ? Number(r.primary_source_amount) : null,
    secondary_source_type: (r.secondary_source_type as SourceType | null) ?? null,
    secondary_source_id: (r.secondary_source_id as string | null) ?? null,
    secondary_source_amount: r.secondary_source_amount ? Number(r.secondary_source_amount) : null,
    description: (r.description as string | null) ?? null,
    amount_requested: r.amount_requested ? Number(r.amount_requested) : null,
    supporting_doc_url: (r.supporting_doc_url as string | null) ?? null,
    submitted_at: (r.submitted_at as string | null) ?? null,
    status: r.status as PmtRequestStatus,
    approval_note: (r.approval_note as string | null) ?? null,
    rejection_reason: (r.rejection_reason as string | null) ?? null,
    approved_by: (r.approved_by as string | null) ?? null,
    approved_at: (r.approved_at as string | null) ?? null,
    budget_released_at: (r.budget_released_at as string | null) ?? null,
    expense_id: (r.expense_id as string | null) ?? null,
    created_at: r.created_at as string,
  };

  return { request, passcode_hash: profile.passcode_hash as string, employee_no: profile.employee_no as string };
}

export async function listSourceOptions(): Promise<SourceOption[]> {
  const admin = createAdminClient();
  const [{ data: accts }, { data: txns }, { data: funds }, { data: pcTxns }] = await Promise.all([
    admin.from("bank_accounts").select("id, label, opening_balance").eq("is_active", true).order("sort_order"),
    admin.from("bank_transactions").select("bank_account_id, direction, amount, status").neq("status", "void"),
    admin.from("petty_cash_funds").select("id, name").eq("is_active", true),
    admin.from("petty_cash_transactions").select("fund_id, kind, amount"),
  ]);

  const bankOptions: SourceOption[] = (accts ?? []).map((a) => {
    let balance = Number(a.opening_balance ?? 0);
    for (const t of (txns ?? []).filter((x) => x.bank_account_id === a.id)) {
      balance += t.direction === "in" ? Number(t.amount) : -Number(t.amount);
    }
    return { id: a.id as string, label: a.label as string, type: "bank" as SourceType, balance: Math.round(balance * 100) / 100 };
  });

  const pcOptions: SourceOption[] = (funds ?? []).map((f) => {
    let balance = 0;
    for (const t of (pcTxns ?? []).filter((x) => x.fund_id === f.id)) {
      balance += t.kind === "load" ? Number(t.amount) : -Number(t.amount);
    }
    return { id: f.id as string, label: f.name as string, type: "petty_cash" as SourceType, balance: Math.round(balance * 100) / 100 };
  });

  return [...bankOptions, ...pcOptions];
}
