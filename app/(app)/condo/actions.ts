"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { condoUnits, getCondoSettings } from "@/lib/condo/queries";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setCondoDefaults(defaultRate: number, bankAccount: string, dueDay: number): Promise<ActionResult> {
  const user = await requireModuleWrite("condo");
  if (!Number.isFinite(defaultRate) || defaultRate < 0) return { ok: false, error: "Enter a valid ₱/sqm rate." };
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) return { ok: false, error: "Due day must be 1–28." };
  const admin = createAdminClient();
  const { error } = await admin.from("condo_settings").update({ default_rate_per_sqm: defaultRate, bank_account: bankAccount.trim() || null, due_day: dueDay, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "condo_settings", entityId: "1", diff: { defaultRate, dueDay } });
  revalidatePath("/condo");
  return { ok: true };
}

export async function setPropertyRate(propertyId: string, rate: number): Promise<ActionResult> {
  const user = await requireModuleWrite("condo");
  if (!propertyId || !Number.isFinite(rate) || rate < 0) return { ok: false, error: "Enter a valid rate." };
  const admin = createAdminClient();
  const { error } = await admin.from("condo_property_rates").upsert({ property_id: propertyId, rate_per_sqm: rate, updated_at: new Date().toISOString() }, { onConflict: "property_id" });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "condo_property_rates", entityId: propertyId, diff: { rate } });
  revalidatePath("/condo");
  return { ok: true };
}

export async function setUnitRateOverride(unitId: string, rate: string): Promise<ActionResult> {
  const user = await requireModuleWrite("condo");
  const val = rate.trim() === "" ? null : Number(rate);
  if (val != null && (!Number.isFinite(val) || val < 0)) return { ok: false, error: "Enter a valid rate or leave blank." };
  const admin = createAdminClient();
  const { error } = await admin.from("units").update({ dues_rate_override: val }).eq("id", unitId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "units", entityId: unitId, diff: { dues_rate_override: val } });
  revalidatePath("/condo");
  return { ok: true };
}

/** Generate association dues (area × rate) for every condo unit for a month. */
export async function generateMonthlyDues(month: string): Promise<ActionResult> {
  const user = await requireModuleWrite("condo");
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Pick a month." };
  const settings = await getCondoSettings();
  const dueDate = `${month}-${String(settings.dueDay).padStart(2, "0")}`;
  const units = await condoUnits();

  const admin = createAdminClient();
  let created = 0;
  for (const u of units) {
    if (u.monthlyDues <= 0) continue;
    // Skip if an association-dues row already exists for this unit + month.
    const { data: existing } = await admin
      .from("rental_dues")
      .select("id")
      .eq("unit_id", u.unitId)
      .eq("category", "association_dues")
      .gte("due_date", `${month}-01`)
      .lte("due_date", `${month}-31`)
      .maybeSingle();
    if (existing) continue;
    await admin.from("rental_dues").insert({
      unit_id: u.unitId,
      category: "association_dues",
      due_date: dueDate,
      amount: u.monthlyDues,
      remarks: `Association dues ${month} (${u.areaSqm} sqm × ${u.effectiveRate})`,
      created_by: user.userId,
    });
    created += 1;
  }

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "rental_dues", entityId: month, diff: { generated: created } });
  revalidatePath("/condo");
  return created > 0 ? { ok: true } : { ok: false, error: "Nothing to generate (already generated or no rates set)." };
}
