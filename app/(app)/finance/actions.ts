"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { COLLECTION_CATEGORIES } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };
const LINES: readonly string[] = COLLECTION_CATEGORIES.map((c) => c.key);
const VALID_VAT = ["none", "vat_inclusive", "non_vat"];

export async function createExpense(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("finance");
  const supabase = await createClient();

  const business_line = String(formData.get("business_line") ?? "other");
  const amount = Number(String(formData.get("amount") ?? ""));
  const category = String(formData.get("category") ?? "Others").trim() || "Others";
  if (!LINES.includes(business_line)) return { ok: false, error: "Choose a business line." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid amount." };

  const row: Record<string, unknown> = {
    business_line,
    category,
    amount,
    vendor: String(formData.get("vendor") ?? "").trim() || null,
    or_number: String(formData.get("or_number") ?? "").trim() || null,
    remarks: String(formData.get("remarks") ?? "").trim() || null,
    entered_by: user.userId,
  };
  const date = String(formData.get("expense_date") ?? "").trim();
  if (date) row.expense_date = date;

  const { data, error } = await supabase.from("expenses").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "expenses",
    entityId: data.id as string,
    diff: { business_line, category, amount },
  });
  revalidatePath("/finance");
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("finance");
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "expenses", entityId: id });
  revalidatePath("/finance");
  return { ok: true };
}

/** Bulk-delete expenses (accounting/admin). */
export async function bulkDeleteExpenses(ids: string[]): Promise<import("@/lib/data/bulk").BulkResult> {
  const user = await requireModuleWrite("finance");
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().in("id", list);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "expenses", entityId: null, diff: { bulk_delete: list.length } });
  revalidatePath("/finance");
  return { ok: true, affected: list.length, skipped: [] };
}

export async function setFinanceVat(vat_mode: string, vat_rate: number): Promise<ActionResult> {
  const user = await requireModuleWrite("finance");
  if (!VALID_VAT.includes(vat_mode)) return { ok: false, error: "Invalid VAT mode." };
  const supabase = await createClient();
  const { error } = await supabase.from("finance_settings").update({ vat_mode, vat_rate }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "finance_settings", entityId: "global", diff: { vat_mode, vat_rate } });
  revalidatePath("/finance");
  return { ok: true };
}
