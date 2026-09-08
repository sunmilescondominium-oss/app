"use server";

import { revalidatePath } from "next/cache";
import { requireModule, requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const APPROVER_ROLES = ["admin", "accounting", "managing_officer"] as const;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveExpenseCategory(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("expenses");
  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const sort_order = Number(formData.get("sort_order") ?? 100);
  const is_active = formData.get("is_active") !== "false";
  if (!name) return { ok: false, error: "Category name is required." };

  const supabase = await createClient();
  const payload = { name, description, sort_order, is_active };
  if (id) {
    const { error } = await supabase.from("expense_categories").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("expense_categories").insert({ ...payload, created_by: user.userId });
    if (error) return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: id ? "update" : "create", entity: "expense_categories", entityId: id ?? name, diff: payload });
  revalidatePath("/expenses");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

export async function saveExpenseVendor(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("expenses");
  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const tin = String(formData.get("tin") ?? "").trim() || null;
  const is_active = formData.get("is_active") !== "false";
  if (!name) return { ok: false, error: "Vendor name is required." };

  const supabase = await createClient();
  const payload = { name, address, contact, tin, is_active };
  if (id) {
    const { error } = await supabase.from("expense_vendors").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("expense_vendors").insert({ ...payload, created_by: user.userId });
    if (error) return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: id ? "update" : "create", entity: "expense_vendors", entityId: id ?? name, diff: payload });
  revalidatePath("/expenses");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Expense settings
// ---------------------------------------------------------------------------

export async function saveExpenseSettings(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("expenses");
  const approval_threshold = Number(formData.get("approval_threshold") ?? 5000);
  if (!Number.isFinite(approval_threshold) || approval_threshold < 0) {
    return { ok: false, error: "Approval threshold must be a non-negative number." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_settings")
    .update({ approval_threshold, updated_by: user.userId, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "expense_settings", entityId: "1", diff: { approval_threshold } });
  revalidatePath("/expenses");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Approve / Reject expense
// ---------------------------------------------------------------------------

export async function approveExpense(expenseId: string): Promise<ActionResult> {
  const user = await requireModule("expenses");
  if (!user.roleKeys.some((r) => APPROVER_ROLES.includes(r as typeof APPROVER_ROLES[number]))) {
    return { ok: false, error: "You do not have permission to approve expenses." };
  }
  const admin = createAdminClient();
  const { data: exp } = await admin.from("expenses").select("id, approval_status, amount").eq("id", expenseId).maybeSingle();
  if (!exp) return { ok: false, error: "Expense not found." };
  if ((exp.approval_status as string) !== "pending") return { ok: false, error: "Expense is not pending approval." };

  const { error } = await admin.from("expenses").update({
    approval_status: "approved",
    approved_by: user.userId,
    approved_at: new Date().toISOString(),
  }).eq("id", expenseId);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "expenses", entityId: expenseId, diff: { approval_status: "approved" } });
  revalidatePath("/expenses");
  revalidatePath("/finance");
  return { ok: true };
}

export async function rejectExpense(expenseId: string, reason: string): Promise<ActionResult> {
  const user = await requireModule("expenses");
  if (!user.roleKeys.some((r) => APPROVER_ROLES.includes(r as typeof APPROVER_ROLES[number]))) {
    return { ok: false, error: "You do not have permission to reject expenses." };
  }
  if (!reason.trim()) return { ok: false, error: "A rejection reason is required." };

  const admin = createAdminClient();
  const { data: exp } = await admin.from("expenses").select("id, approval_status").eq("id", expenseId).maybeSingle();
  if (!exp) return { ok: false, error: "Expense not found." };
  if ((exp.approval_status as string) !== "pending") return { ok: false, error: "Expense is not pending approval." };

  const { error } = await admin.from("expenses").update({
    approval_status: "rejected",
    approved_by: user.userId,
    approved_at: new Date().toISOString(),
    remarks: reason.trim(),
  }).eq("id", expenseId);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "expenses", entityId: expenseId, diff: { approval_status: "rejected", reason } });
  revalidatePath("/expenses");
  revalidatePath("/finance");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Petty cash fund management
// ---------------------------------------------------------------------------

export async function savePettyCashFund(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("expenses");
  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const opening_balance = Number(formData.get("opening_balance") ?? 0);
  const low_balance_threshold = Number(formData.get("low_balance_threshold") ?? 500);
  const pcv_prefix = String(formData.get("pcv_prefix") ?? "PCV").trim() || "PCV";
  const is_active = formData.get("is_active") !== "false";

  if (!name) return { ok: false, error: "Fund name is required." };
  if (!Number.isFinite(opening_balance) || opening_balance < 0) return { ok: false, error: "Opening balance must be a non-negative number." };

  const admin = createAdminClient();
  if (id) {
    const { error } = await admin.from("petty_cash_funds").update({ name, low_balance_threshold, pcv_prefix, is_active }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("petty_cash_funds").insert({ name, opening_balance, low_balance_threshold, pcv_prefix, is_active });
    if (error) return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: id ? "update" : "create", entity: "petty_cash_funds", entityId: id ?? name, diff: { name } });
  revalidatePath("/expenses");
  revalidatePath("/petty-cash");
  return { ok: true };
}

export async function loadPettyCashFund(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("expenses");
  const fund_id = String(formData.get("fund_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const bank_account_id = String(formData.get("bank_account_id") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || "Cash replenishment";

  if (!fund_id) return { ok: false, error: "Select a petty cash fund." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Load amount must be greater than zero." };

  const admin = createAdminClient();
  const { data: fund } = await admin.from("petty_cash_funds").select("id, name").eq("id", fund_id).maybeSingle();
  if (!fund) return { ok: false, error: "Fund not found." };

  const { error } = await admin.from("petty_cash_transactions").insert({
    fund_id,
    kind: "load",
    amount,
    bank_account_id,
    description,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "petty_cash_transactions", entityId: fund_id, diff: { kind: "load", amount } });
  revalidatePath("/expenses");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Record a general expense
// ---------------------------------------------------------------------------

export async function recordExpense(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("expenses");
  const expense_date = String(formData.get("expense_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const expense_category_id = String(formData.get("expense_category_id") ?? "").trim() || null;
  const expense_vendor_id = String(formData.get("expense_vendor_id") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? "");
  const source = String(formData.get("source") ?? "bank") as "bank" | "petty_cash";
  const bank_account_id = String(formData.get("bank_account_id") ?? "").trim() || null;
  const petty_cash_fund_id = String(formData.get("petty_cash_fund_id") ?? "").trim() || null;
  const or_number = String(formData.get("or_number") ?? "").trim() || null;
  const proof_url = String(formData.get("proof_url") ?? "").trim() || null;
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  if (!expense_date) return { ok: false, error: "Date is required." };
  if (!description) return { ok: false, error: "Description is required." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Amount must be a positive number." };
  if (source === "bank" && !bank_account_id) return { ok: false, error: "Select the bank account used." };
  if (source === "petty_cash" && !petty_cash_fund_id) return { ok: false, error: "Select which petty cash fund to draw from." };

  const admin = createAdminClient();

  // Check petty cash balance before recording
  if (source === "petty_cash" && petty_cash_fund_id) {
    const { data: fund } = await admin.from("petty_cash_funds").select("opening_balance, name").eq("id", petty_cash_fund_id).maybeSingle();
    if (!fund) return { ok: false, error: "Petty cash fund not found." };
    const { data: txns } = await admin.from("petty_cash_transactions").select("kind, amount").eq("fund_id", petty_cash_fund_id);
    const balance = (txns ?? []).reduce((s, t) => s + (t.kind === "load" ? Number(t.amount) : -Number(t.amount)), Number(fund.opening_balance ?? 0));
    if (amount > balance) {
      return { ok: false, error: `Insufficient balance in "${fund.name as string}". Available: ₱${balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` };
    }
  }

  // Determine approval status based on threshold
  const supabase = await createClient();
  const { data: settingsRow } = await admin.from("expense_settings").select("approval_threshold").eq("id", 1).maybeSingle();
  const threshold = Number((settingsRow as Record<string, unknown> | null)?.approval_threshold ?? 5000);
  const approval_status = amount >= threshold ? "pending" : "approved";

  const { data: newExpense, error } = await supabase.from("expenses").insert({
    expense_date,
    business_line: "general",
    description,
    amount,
    source,
    bank_account_id: source === "bank" ? bank_account_id : null,
    petty_cash_fund_id: source === "petty_cash" ? petty_cash_fund_id : null,
    expense_category_id,
    expense_vendor_id,
    or_number,
    proof_url,
    approval_status,
    remarks,
    created_by: user.userId,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };

  // Create petty cash disbursement transaction
  if (source === "petty_cash" && petty_cash_fund_id && newExpense) {
    await admin.from("petty_cash_transactions").insert({
      fund_id: petty_cash_fund_id,
      kind: "disbursement",
      amount,
      expense_id: newExpense.id as string,
      description,
      created_by: user.userId,
    });
  }

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "expenses", entityId: expense_date, diff: { amount, source, description } });
  revalidatePath("/expenses");
  revalidatePath("/finance");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CSV bulk import of historical expenses
// ---------------------------------------------------------------------------

export interface CsvImportRow {
  expense_date: string;
  category_name: string;
  vendor_name: string;
  amount: number;
  or_number: string | null;
  source: string;
  bank_account_label: string | null;
  remarks: string | null;
}

export async function importExpensesFromCsv(rows: CsvImportRow[]): Promise<ActionResult & { imported?: number }> {
  const user = await requireModuleWrite("expenses");
  if (!rows.length) return { ok: false, error: "No rows to import." };

  const adminSupa = createAdminClient();

  // Resolve category names → IDs
  const { data: cats } = await adminSupa.from("expense_categories").select("id, name");
  const catMap = new Map((cats ?? []).map((c: Record<string, unknown>) => [(c.name as string).toLowerCase(), c.id as string]));

  // Resolve vendor names → IDs
  const { data: vends } = await adminSupa.from("expense_vendors").select("id, name");
  const vendMap = new Map((vends ?? []).map((v: Record<string, unknown>) => [(v.name as string).toLowerCase(), v.id as string]));

  // Resolve bank account labels → IDs
  const { data: accts } = await adminSupa.from("bank_accounts").select("id, label");
  const acctMap = new Map((accts ?? []).map((a: Record<string, unknown>) => [(a.label as string).toLowerCase(), a.id as string]));

  const inserts = rows.map((r) => ({
    expense_date: r.expense_date,
    business_line: "general",
    description: `${r.category_name}${r.vendor_name ? " – " + r.vendor_name : ""}`,
    amount: r.amount,
    source: ["bank", "petty_cash"].includes(r.source) ? r.source : "import",
    bank_account_id: r.bank_account_label ? (acctMap.get(r.bank_account_label.toLowerCase()) ?? null) : null,
    expense_category_id: catMap.get(r.category_name.toLowerCase()) ?? null,
    expense_vendor_id: vendMap.get(r.vendor_name.toLowerCase()) ?? null,
    or_number: r.or_number,
    approval_status: "approved",
    remarks: r.remarks,
    created_by: user.userId,
  }));

  const { error } = await adminSupa.from("expenses").insert(inserts);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "expenses_import", entityId: "bulk", diff: { count: inserts.length } });
  revalidatePath("/expenses");
  revalidatePath("/finance");
  return { ok: true, imported: inserts.length };
}
