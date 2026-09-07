"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Load petty cash fund from a bank account (cash withdrawal)
// ---------------------------------------------------------------------------

export async function loadPettyCashFund(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("petty_cash");
  const fund_id = String(formData.get("fund_id") ?? "").trim();
  const bank_account_id = String(formData.get("bank_account_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!fund_id) return { ok: false, error: "Select a petty cash fund." };
  if (!bank_account_id) return { ok: false, error: "Select the bank account to withdraw from." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Amount must be a positive number." };

  const supabase = await createClient();
  const { error } = await supabase.from("petty_cash_transactions").insert({
    fund_id,
    kind: "load",
    amount,
    bank_account_id,
    description: description ?? `Fund loaded from bank`,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "petty_cash_transactions", entityId: fund_id, diff: { kind: "load", amount, bank_account_id } });
  revalidatePath("/petty-cash");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Record a petty cash disbursement (creates linked expense record too)
// ---------------------------------------------------------------------------

export async function recordPettyCashDisbursement(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("petty_cash");
  const fund_id = String(formData.get("fund_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "");
  const expense_date = String(formData.get("expense_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const expense_category_id = String(formData.get("expense_category_id") ?? "").trim() || null;
  const expense_vendor_id = String(formData.get("expense_vendor_id") ?? "").trim() || null;
  const or_number = String(formData.get("or_number") ?? "").trim() || null;
  const receipt_url = String(formData.get("receipt_url") ?? "").trim() || null;
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  if (!fund_id) return { ok: false, error: "Select a petty cash fund." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Amount must be a positive number." };
  if (!expense_date) return { ok: false, error: "Date is required." };
  if (!description) return { ok: false, error: "Description is required." };

  const adminSupa = createAdminClient();

  // Check fund balance
  const { data: txns } = await adminSupa
    .from("petty_cash_transactions")
    .select("kind, amount")
    .eq("fund_id", fund_id);
  const balance = (txns ?? []).reduce((sum: number, t: Record<string, unknown>) => {
    return sum + (t.kind === "load" ? Number(t.amount) : -Number(t.amount));
  }, 0);
  if (amount > balance + 1e-9) {
    return { ok: false, error: `Insufficient petty cash balance (₱${balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}).` };
  }

  // Auto-assign PCV number
  const { data: fund } = await adminSupa
    .from("petty_cash_funds")
    .select("pcv_prefix, pcv_sequence")
    .eq("id", fund_id)
    .maybeSingle();
  if (!fund) return { ok: false, error: "Petty cash fund not found." };
  const fundRow = fund as Record<string, unknown>;
  const nextSeq = Number(fundRow.pcv_sequence) + 1;
  const pcv_no = `${fundRow.pcv_prefix}-${String(nextSeq).padStart(3, "0")}`;

  const supabase = await createClient();

  // Create expense record
  const { data: expenseRow, error: expErr } = await supabase
    .from("expenses")
    .insert({
      expense_date,
      business_line: "general",
      description,
      amount,
      source: "petty_cash",
      expense_category_id,
      expense_vendor_id,
      or_number,
      proof_url: receipt_url,
      approval_status: "approved",
      remarks,
      created_by: user.userId,
      actor_role: user.roleKeys[0] ?? "accounting",
    })
    .select("id")
    .single();
  if (expErr) return { ok: false, error: `Could not create expense record: ${expErr.message}` };
  const expenseId = (expenseRow as Record<string, unknown>).id as string;

  // Create petty cash transaction
  const { error: txnErr } = await supabase.from("petty_cash_transactions").insert({
    fund_id,
    kind: "disbursement",
    amount,
    expense_id: expenseId,
    pcv_no,
    description,
    receipt_url,
    created_by: user.userId,
  });
  if (txnErr) return { ok: false, error: `Could not create petty cash transaction: ${txnErr.message}` };

  // Increment pcv_sequence on the fund
  await adminSupa.from("petty_cash_funds").update({ pcv_sequence: nextSeq }).eq("id", fund_id);

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "petty_cash_transactions", entityId: fund_id, diff: { kind: "disbursement", amount, pcv_no } });
  revalidatePath("/petty-cash");
  revalidatePath("/expenses");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Update fund settings (threshold, custodian, prefix)
// ---------------------------------------------------------------------------

export async function savePettyCashFundSettings(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("petty_cash");
  const fund_id = String(formData.get("fund_id") ?? "").trim();
  const low_balance_threshold = Number(formData.get("low_balance_threshold") ?? 500);
  const pcv_prefix = String(formData.get("pcv_prefix") ?? "PCV").trim();
  const custodian_user_id = String(formData.get("custodian_user_id") ?? "").trim() || null;

  if (!fund_id) return { ok: false, error: "Fund ID is required." };
  if (!Number.isFinite(low_balance_threshold) || low_balance_threshold < 0) return { ok: false, error: "Threshold must be a non-negative number." };
  if (!pcv_prefix) return { ok: false, error: "PCV prefix is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("petty_cash_funds")
    .update({ low_balance_threshold, pcv_prefix, custodian_user_id })
    .eq("id", fund_id);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "petty_cash_funds", entityId: fund_id, diff: { low_balance_threshold, pcv_prefix, custodian_user_id } });
  revalidatePath("/petty-cash");
  return { ok: true };
}
