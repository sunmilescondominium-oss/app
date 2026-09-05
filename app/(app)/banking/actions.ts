"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { accountBalances, getAccount } from "@/lib/banking/queries";
import type { AccountType, TxnKind } from "@/lib/banking/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ACCOUNT_TYPES: AccountType[] = ["collection", "disbursement", "payroll", "general"];

function primaryRole(roleKeys: string[]): string {
  return roleKeys.includes("accounting") ? "accounting" : roleKeys[0] ?? "accounting";
}

/** Create or edit a bank account. */
export async function saveAccount(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("banking");
  const id = String(formData.get("id") ?? "").trim() || null;
  const label = String(formData.get("label") ?? "").trim();
  const bank_name = String(formData.get("bank_name") ?? "").trim() || null;
  const account_no_masked = String(formData.get("account_no_masked") ?? "").trim() || null;
  const account_type = String(formData.get("account_type") ?? "collection") as AccountType;
  const opening_balance = Number(formData.get("opening_balance") ?? 0);
  const is_active = formData.get("is_active") != null;
  if (!label) return { ok: false, error: "Account label is required." };
  if (!ACCOUNT_TYPES.includes(account_type)) return { ok: false, error: "Invalid account type." };
  if (!Number.isFinite(opening_balance)) return { ok: false, error: "Opening balance must be a number." };

  const supabase = await createClient();
  const payload = { label, bank_name, account_no_masked, account_type, opening_balance, is_active };
  if (id) {
    const { error } = await supabase.from("bank_accounts").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("bank_accounts").insert({ ...payload, is_active: true });
    if (error) return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: id ? "update" : "create", entity: "bank_accounts", entityId: id ?? label, diff: payload });
  revalidatePath("/banking");
  return { ok: true };
}

/** Record a deposit into an account (optionally linked to a transmittal). */
export async function recordDeposit(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("banking");
  const bank_account_id = String(formData.get("bank_account_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "");
  const txn_date = String(formData.get("txn_date") ?? "").trim() || undefined;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const counterparty = String(formData.get("counterparty") ?? "").trim() || null;
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const transmittal_id = String(formData.get("transmittal_id") ?? "").trim() || null;
  if (!bank_account_id || !Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Choose an account and a positive amount." };

  const supabase = await createClient();
  const { error } = await supabase.from("bank_transactions").insert({
    bank_account_id, txn_date, direction: "in", amount, kind: "deposit",
    reference, counterparty, memo, transmittal_id, status: "pending",
    created_by: user.userId, actor_role: primaryRole(user.roleKeys),
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "bank_transactions", entityId: bank_account_id, diff: { deposit: amount, transmittal_id } });
  revalidatePath(`/banking/${bank_account_id}`);
  revalidatePath("/banking");
  return { ok: true };
}

/**
 * Release a check (disbursement). Balances the account: the check cannot exceed
 * the available (book) balance, so an account can never be over-released.
 */
export async function releaseCheck(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("banking");
  const bank_account_id = String(formData.get("bank_account_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "");
  const txn_date = String(formData.get("txn_date") ?? "").trim() || undefined;
  const reference = String(formData.get("reference") ?? "").trim() || null; // check no.
  const counterparty = String(formData.get("counterparty") ?? "").trim() || null; // payee
  const memo = String(formData.get("memo") ?? "").trim() || null;
  if (!bank_account_id || !Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Choose an account and a positive amount." };
  if (!counterparty) return { ok: false, error: "Payee is required for a check." };

  const account = await getAccount(bank_account_id);
  if (!account) return { ok: false, error: "Account not found." };
  const balances = await accountBalances(bank_account_id, account.opening_balance);
  if (amount > balances.book + 1e-9) {
    return { ok: false, error: `Check exceeds available balance (₱${balances.book.toLocaleString("en-PH", { minimumFractionDigits: 2 })}).` };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bank_transactions").insert({
    bank_account_id, txn_date, direction: "out", amount, kind: "check",
    reference, counterparty, memo, status: "pending",
    created_by: user.userId, actor_role: primaryRole(user.roleKeys),
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "bank_transactions", entityId: bank_account_id, diff: { check: amount, payee: counterparty, ref: reference } });
  revalidatePath(`/banking/${bank_account_id}`);
  revalidatePath("/banking");
  return { ok: true };
}

/** Record any other ledger entry (withdrawal, transfer, bank charge, interest, adjustment). */
export async function recordEntry(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("banking");
  const bank_account_id = String(formData.get("bank_account_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "");
  const kind = String(formData.get("kind") ?? "") as TxnKind;
  const txn_date = String(formData.get("txn_date") ?? "").trim() || undefined;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const counterparty = String(formData.get("counterparty") ?? "").trim() || null;
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const allowed: TxnKind[] = ["withdrawal", "transfer", "bank_charge", "interest", "adjustment"];
  if (!allowed.includes(kind)) return { ok: false, error: "Invalid entry type." };
  if (!bank_account_id || !Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Choose an account and a positive amount." };

  // interest = money in; everything else here reduces the balance.
  const direction = kind === "interest" ? "in" : "out";
  const supabase = await createClient();
  const { error } = await supabase.from("bank_transactions").insert({
    bank_account_id, txn_date, direction, amount, kind,
    reference, counterparty, memo, status: "pending",
    created_by: user.userId, actor_role: primaryRole(user.roleKeys),
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "bank_transactions", entityId: bank_account_id, diff: { kind, amount } });
  revalidatePath(`/banking/${bank_account_id}`);
  return { ok: true };
}

/** Mark a transaction cleared/void on the bank statement (reconciliation step). */
export async function setTxnStatus(txnId: string, accountId: string, status: "pending" | "cleared" | "void"): Promise<ActionResult> {
  const user = await requireModuleWrite("banking");
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ status, cleared_on: status === "cleared" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", txnId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "bank_transactions", entityId: txnId, diff: { status } });
  revalidatePath(`/banking/${accountId}`);
  revalidatePath("/banking");
  return { ok: true };
}

/**
 * Correct a deposit that was recorded against the wrong bank account.
 * Only works on pending deposits (not yet cleared). Voids the original entry
 * and re-creates an identical deposit on the correct account, preserving all
 * amounts, dates, references, and the transmittal link.
 * Restricted to accounting and admin.
 */
export async function correctDepositBank(
  txnId: string,
  newAccountId: string,
  reason: string,
): Promise<ActionResult> {
  const user = await requireModuleWrite("banking");
  if (!user.roleKeys.some((r) => ["accounting", "admin"].includes(r))) {
    return { ok: false, error: "Only accounting or admin can correct a deposit's bank account." };
  }
  if (!newAccountId) return { ok: false, error: "Select the correct bank account." };
  if (!reason.trim()) return { ok: false, error: "A reason is required for audit purposes." };

  const supabase = await createClient();

  // Fetch the original transaction
  const { data: orig, error: fetchErr } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("id", txnId)
    .maybeSingle();
  if (fetchErr || !orig) return { ok: false, error: "Transaction not found." };
  if (orig.kind !== "deposit") return { ok: false, error: "Only deposit transactions can be moved to a different account." };
  if (orig.status !== "pending") return { ok: false, error: "Only pending (uncleared) deposits can be corrected. Contact your supervisor for cleared entries." };
  if (orig.bank_account_id === newAccountId) return { ok: false, error: "The deposit is already on that account." };

  const oldAccountId = orig.bank_account_id as string;

  // Void the original entry
  const { error: voidErr } = await supabase
    .from("bank_transactions")
    .update({ status: "void", memo: `${orig.memo ? orig.memo + " · " : ""}[Voided — moved to correct account: ${reason.trim()}]` })
    .eq("id", txnId);
  if (voidErr) return { ok: false, error: `Could not void original entry: ${voidErr.message}` };

  // Re-create on the correct account
  const { error: insErr } = await supabase.from("bank_transactions").insert({
    bank_account_id: newAccountId,
    txn_date: orig.txn_date,
    direction: "in",
    amount: orig.amount,
    kind: "deposit",
    reference: orig.reference,
    counterparty: orig.counterparty,
    memo: `${orig.memo ? orig.memo + " · " : ""}[Corrected from wrong account — ${reason.trim()}]`,
    transmittal_id: orig.transmittal_id,
    status: "pending",
    created_by: user.userId,
    actor_role: primaryRole(user.roleKeys),
  });
  if (insErr) return { ok: false, error: `Could not create corrected entry: ${insErr.message}` };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "bank_transactions",
    entityId: txnId,
    diff: { correction: "wrong_bank", from_account: oldAccountId, to_account: newAccountId, reason: reason.trim(), amount: orig.amount },
  });

  revalidatePath(`/banking/${oldAccountId}`);
  revalidatePath(`/banking/${newAccountId}`);
  revalidatePath("/banking");
  return { ok: true };
}

/** Snapshot a bank reconciliation for the account (statement vs book-cleared). */
export async function saveReconciliation(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("banking");
  const bank_account_id = String(formData.get("bank_account_id") ?? "").trim();
  const statement_date = String(formData.get("statement_date") ?? "").trim();
  const statement_balance = Number(formData.get("statement_balance") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!bank_account_id || !statement_date || !Number.isFinite(statement_balance)) {
    return { ok: false, error: "Enter the statement date and closing balance." };
  }
  const account = await getAccount(bank_account_id);
  if (!account) return { ok: false, error: "Account not found." };
  const balances = await accountBalances(bank_account_id, account.opening_balance);
  const difference = Math.round((statement_balance - balances.cleared) * 100) / 100;

  const supabase = await createClient();
  const { error } = await supabase.from("bank_reconciliations").insert({
    bank_account_id, statement_date, statement_balance,
    book_cleared_balance: balances.cleared, difference,
    reconciled_by_role: primaryRole(user.roleKeys), note,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "bank_reconciliations", entityId: bank_account_id, diff: { statement_balance, difference } });
  revalidatePath(`/banking/${bank_account_id}`);
  return { ok: true };
}
