"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { BILLING_ITEM_TYPES } from "@/lib/config";

export type RcActionResult = { ok: true } | { ok: false; error: string };

const ALLOWED_ROLES = [
  "hotel_rental_monitoring", "accounting", "admin", "managing_officer", "consultant",
];

export async function upsertRateCard(
  _prev: RcActionResult | undefined,
  formData: FormData,
): Promise<RcActionResult> {
  const user = await requireModuleWrite("collections");
  if (!user.allRoleKeys.some((r) => ALLOWED_ROLES.includes(r))) {
    return { ok: false, error: "You don't have permission to manage rate cards." };
  }

  const unit_id = String(formData.get("unit_id") ?? "").trim();
  const item_key = String(formData.get("item_key") ?? "").trim();
  const label_raw = String(formData.get("label") ?? "").trim();
  const monthly_amount = Number(formData.get("monthly_amount") ?? 0);
  const effective_from = String(formData.get("effective_from") ?? "").trim();
  const effective_until = String(formData.get("effective_until") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!unit_id) return { ok: false, error: "Select a unit." };
  if (!item_key || !BILLING_ITEM_TYPES.find((t) => t.key === item_key))
    return { ok: false, error: "Choose a valid item type." };
  if (!Number.isFinite(monthly_amount) || monthly_amount < 0)
    return { ok: false, error: "Enter a valid monthly amount." };
  if (!effective_from) return { ok: false, error: "Set the effective date." };

  const label = label_raw || (BILLING_ITEM_TYPES.find((t) => t.key === item_key)?.label ?? item_key);

  const admin = createAdminClient();
  const { error } = await admin.from("unit_rate_cards").upsert(
    { unit_id, item_key, label, monthly_amount, effective_from, effective_until, notes, created_by: user.userId },
    { onConflict: "unit_id,item_key,effective_from" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/rate-cards");
  return { ok: true };
}

export async function deleteRateCard(id: string): Promise<RcActionResult> {
  const user = await requireModuleWrite("collections");
  if (!user.allRoleKeys.some((r) => ALLOWED_ROLES.includes(r))) {
    return { ok: false, error: "No permission." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("unit_rate_cards").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/rate-cards");
  return { ok: true };
}

export async function generateMonthlyBills(
  _prev: RcActionResult | undefined,
  formData: FormData,
): Promise<RcActionResult> {
  const user = await requireModuleWrite("collections");
  if (!user.allRoleKeys.some((r) => ALLOWED_ROLES.includes(r))) {
    return { ok: false, error: "No permission." };
  }

  const period_month = String(formData.get("period_month") ?? "").trim();
  if (!/^\d{4}-\d{2}-01$/.test(period_month))
    return { ok: false, error: "Period must be the first day of a month (YYYY-MM-01)." };

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all active rate cards effective for this period
  const { data: cards, error: cardErr } = await admin
    .from("unit_rate_cards")
    .select("unit_id, item_key, label, monthly_amount")
    .lte("effective_from", period_month)
    .or("effective_until.is.null,effective_until.gte." + period_month);
  if (cardErr) return { ok: false, error: cardErr.message };

  let generated = 0;
  for (const card of cards ?? []) {
    const { error } = await admin.from("unit_bills").upsert(
      {
        unit_id: card.unit_id as string,
        period_month,
        item_key: card.item_key as string,
        label: card.label as string,
        amount_billed: card.monthly_amount as number,
        created_by: user.userId,
      },
      { onConflict: "unit_id,period_month,item_key", ignoreDuplicates: true },
    );
    if (!error) generated++;
  }

  revalidatePath("/admin/rate-cards");
  return { ok: true };
}
