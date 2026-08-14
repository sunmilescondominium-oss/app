"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { roomCharge, promoDiscount, stayTotals, round2 } from "@/lib/hotel/rates";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";
import { HOTEL_PAYMENT_METHODS, ROOM_ASSET_CHECKLIST } from "@/lib/config";
import { createCleaningTask } from "@/lib/housekeeping/create-task";
import { createNotification } from "@/lib/notifications/queries";
import type { ImportResult } from "@/lib/imports/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
const METHODS: readonly string[] = HOTEL_PAYMENT_METHODS.map((m) => m.key);

export type CheckInResult = { ok: true; stayId: string } | { ok: false; error: string };

export async function checkIn(
  unitId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<CheckInResult> {
  const user = await requireModuleWrite("hotel");
  const supabase = await createClient();

  const rate_plan_id = String(formData.get("rate_plan_id") ?? "").trim();
  if (!rate_plan_id) return { ok: false, error: "Choose a rate plan." };

  const { data: plan } = await supabase.from("rate_plans").select("*").eq("id", rate_plan_id).maybeSingle();
  if (!plan) return { ok: false, error: "Rate plan not found." };

  const { data: existing } = await supabase
    .from("stays")
    .select("id")
    .eq("unit_id", unitId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: false, error: "Room is already occupied." };

  // Room must be cleaned (no open housekeeping task) before it can be occupied.
  const { data: hk } = await supabase
    .from("housekeeping_tasks")
    .select("id")
    .eq("unit_id", unitId)
    .in("status", ["pending", "in_progress"])
    .limit(1)
    .maybeSingle();
  if (hk) return { ok: false, error: "Room needs housekeeping before it can be occupied." };

  const base_hours = plan.base_hours as number;
  const base_rate = Number(plan.base_rate);
  const extra_hour_rate = Number(plan.extra_hour_rate);
  let planned_hours = parseInt(String(formData.get("planned_hours") ?? ""), 10);
  if (!Number.isFinite(planned_hours) || planned_hours < base_hours) planned_hours = base_hours;

  const promo_id = String(formData.get("promo_id") ?? "").trim() || null;
  let discount_amount = 0;
  if (promo_id) {
    const { data: promo } = await supabase
      .from("promos")
      .select("disc_type, disc_value")
      .eq("id", promo_id)
      .maybeSingle();
    if (promo) {
      const rc = roomCharge(base_rate, extra_hour_rate, base_hours, planned_hours);
      discount_amount = promoDiscount(rc, promo.disc_type as string, Number(promo.disc_value));
    }
  }

  // Pay-before-entry: the full room fee must be collected in advance at check-in.
  // TODO(client-confirm): per-room base price (small/big/fan/aircon) will come
  // from Inventory — for now the room fee is the selected rate plan's charge.
  const requiredAdvance = round2(roomCharge(base_rate, extra_hour_rate, base_hours, planned_hours) - discount_amount);
  const advanceMethod = String(formData.get("advance_method") ?? "").trim();
  const advanceAmount = Number(String(formData.get("advance_amount") ?? ""));
  if (!METHODS.includes(advanceMethod)) return { ok: false, error: "Choose the advance payment method." };
  if (!Number.isFinite(advanceAmount) || advanceAmount < requiredAdvance)
    return { ok: false, error: `Advance payment of the full room fee (₱${requiredAdvance.toLocaleString("en-PH")}) is required before entry.` };

  // Effective tax = per-room override, else global setting (snapshot onto stay).
  let tax_mode = "none";
  let tax_rate = 0;
  const { data: rt } = await supabase.from("room_tax").select("tax_mode, tax_rate").eq("unit_id", unitId).maybeSingle();
  if (rt) {
    tax_mode = rt.tax_mode as string;
    tax_rate = Number(rt.tax_rate);
  } else {
    const { data: g } = await supabase.from("hotel_tax_settings").select("tax_mode, tax_rate").eq("id", 1).maybeSingle();
    if (g) {
      tax_mode = g.tax_mode as string;
      tax_rate = Number(g.tax_rate);
    }
  }

  const { data, error } = await supabase
    .from("stays")
    .insert({
      unit_id: unitId,
      guest_label: String(formData.get("guest_label") ?? "").trim() || "Guest",
      guest_contact: String(formData.get("guest_contact") ?? "").trim() || null,
      rate_plan_id,
      planned_hours,
      base_hours,
      base_rate,
      extra_hour_rate,
      promo_id,
      discount_amount,
      tax_mode,
      tax_rate,
      portal_token: (await import("node:crypto")).randomBytes(18).toString("base64url"),
      created_by: user.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Record the advance payment + post to collections (initial receipt).
  const admin = createAdminClient();
  const { data: arNo } = await admin.rpc("next_receipt_no", { ctx: "hotel" });
  const receipt_no = `OR-${Date.now().toString(36).toUpperCase()}`;
  await admin.from("stay_payments").insert({ stay_id: data.id, method: advanceMethod, amount: advanceAmount, receipt_no, ar_no: (arNo as string | null) ?? null, created_by: user.userId });
  await admin.from("collections").insert({
    business_line: "hotel", unit_id: unitId, amount: advanceAmount, or_number: receipt_no,
    payment_type: advanceMethod, collected_by_role: user.roleKeys.find((r) => ["hotel_cashier", "hotel_rental_monitoring"].includes(r)) ?? "hotel_cashier",
    collected_on: todayManila(), remarks: "Hotel advance payment (check-in)",
  });

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "stays",
    entityId: data.id as string,
    diff: { unitId, planned_hours, advance: advanceAmount },
  });
  revalidatePath("/hotel");
  return { ok: true, stayId: data.id as string };
}

export async function extendStay(stayId: string, addedHours: number): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  if (!Number.isFinite(addedHours) || addedHours <= 0)
    return { ok: false, error: "Enter hours to add." };
  const supabase = await createClient();

  const { data: s } = await supabase.from("stays").select("*").eq("id", stayId).maybeSingle();
  if (!s) return { ok: false, error: "Stay not found." };
  if (s.status !== "active") return { ok: false, error: "Stay is not active." };

  const planned_hours = (s.planned_hours as number) + addedHours;
  let discount_amount = Number(s.discount_amount);
  if (s.promo_id) {
    const { data: promo } = await supabase
      .from("promos")
      .select("disc_type, disc_value")
      .eq("id", s.promo_id)
      .maybeSingle();
    if (promo) {
      const rc = roomCharge(Number(s.base_rate), Number(s.extra_hour_rate), s.base_hours as number, planned_hours);
      discount_amount = promoDiscount(rc, promo.disc_type as string, Number(promo.disc_value));
    }
  }

  await supabase.from("stays").update({ planned_hours, discount_amount }).eq("id", stayId);
  await supabase.from("stay_extensions").insert({ stay_id: stayId, added_hours: addedHours });
  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "stays",
    entityId: stayId,
    diff: { extended: addedHours, planned_hours },
  });
  revalidatePath("/hotel");
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}

export async function recordStayPayment(
  stayId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  const supabase = await createClient();

  const method = String(formData.get("method") ?? "cash");
  const amount = Number(String(formData.get("amount") ?? ""));
  if (!METHODS.includes(method)) return { ok: false, error: "Choose a payment method." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid amount." };

  let receipt_no = String(formData.get("receipt_no") ?? "").trim();
  if (!receipt_no) receipt_no = `OR-${Date.now().toString(36).toUpperCase()}`;

  // Internal Acknowledgement Receipt from the monitoring-configured hotel series.
  const adminForAr = createAdminClient();
  const { data: arNo } = await adminForAr.rpc("next_receipt_no", { ctx: "hotel" });
  const ar_no = (arNo as string | null) ?? null;

  const { error } = await supabase.from("stay_payments").insert({
    stay_id: stayId,
    method,
    amount,
    receipt_no,
    ar_no,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };

  // Post to collections so the payment flows into the daily dashboard + transmittal.
  const { data: stayRow } = await supabase.from("stays").select("unit_id").eq("id", stayId).maybeSingle();
  const collectedRole =
    user.roleKeys.find((r) => ["hotel_cashier", "hotel_rental_monitoring"].includes(r)) ?? "hotel_cashier";
  const admin = createAdminClient();
  await admin.from("collections").insert({
    business_line: "hotel",
    unit_id: stayRow?.unit_id ?? null,
    amount,
    or_number: receipt_no,
    payment_type: method,
    collected_by_role: collectedRole,
    collected_on: todayManila(),
    remarks: "Hotel folio payment",
    created_by: user.userId,
  });

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "stay_payments",
    entityId: stayId,
    diff: { method, amount, receipt_no },
  });
  revalidatePath(`/hotel/${stayId}`);
  revalidatePath("/hotel");
  revalidatePath("/collections");
  return { ok: true };
}

export async function checkOut(stayId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  const supabase = await createClient();
  const { error } = await supabase
    .from("stays")
    .update({ status: "checked_out", check_out_at: new Date().toISOString(), portal_token: null })
    .eq("id", stayId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };

  // Auto-create the post-checkout housekeeping task with its room-type SLA
  // (buffer to start + target clean time). The attendant must start it right
  // away; the board decides from the timers + their shift end what carries over.
  const { data: outStay } = await supabase.from("stays").select("unit_id").eq("id", stayId).maybeSingle();
  await createCleaningTask({ unitId: outStay?.unit_id ?? null, stayId, actorUserId: user.userId, via: "checkout" });

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "stays",
    entityId: stayId,
    diff: { status: "checked_out" },
  });
  revalidatePath("/hotel");
  revalidatePath(`/hotel/${stayId}`);
  revalidatePath("/housekeeping");
  return { ok: true };
}

// ---- pre-checkout room asset check + gate pass ---------------------------
export async function issueRoomCheck(
  stayId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["hotel_cashier", "hotel_rental_monitoring", "room_attendant", "admin"]))
    return { ok: false, error: "Not allowed to issue a gate pass." };
  const supabase = await createClient();

  const results = ROOM_ASSET_CHECKLIST.map((a) => ({
    key: a.key,
    label: a.label,
    expected: a.expected,
    actual: Number(formData.get(`asset_${a.key}`) ?? a.expected),
  }));
  // Incidentals must be settled before a gate pass — balance has to be zero.
  const { data: stayFull } = await supabase.from("stays").select("base_rate, extra_hour_rate, base_hours, planned_hours, discount_amount").eq("id", stayId).maybeSingle();
  const [{ data: pays }, { data: ords }] = await Promise.all([
    supabase.from("stay_payments").select("amount").eq("stay_id", stayId),
    supabase.from("stay_orders").select("qty, unit_price").eq("stay_id", stayId),
  ]);
  if (stayFull) {
    const paid = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0);
    const ordersTotal = (ords ?? []).reduce((a, o) => a + Number(o.qty) * Number(o.unit_price), 0);
    const { balance } = stayTotals(stayFull as never, paid, ordersTotal);
    if (balance > 0) return { ok: false, error: `Balance of ₱${balance.toLocaleString("en-PH")} must be paid before the gate pass is issued.` };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const gatepass_no = `GP-${Date.now().toString(36).toUpperCase()}`;
  const { data: stayRow } = await supabase.from("stays").select("unit_id").eq("id", stayId).maybeSingle();
  const role = user.roleKeys.find((r) => ["hotel_cashier", "hotel_rental_monitoring", "room_attendant"].includes(r)) ?? "hotel_cashier";

  const { error } = await supabase.from("room_checks").insert({
    stay_id: stayId,
    unit_id: stayRow?.unit_id ?? null,
    results,
    notes,
    gatepass_no,
    checked_by_role: role,
  });
  if (error) return { ok: false, error: error.message };
  // Gate pass issued → revoke the guest QR portal (balance is already zero).
  await supabase.from("stays").update({ portal_token: null }).eq("id", stayId);
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "room_checks", entityId: stayId, diff: { gatepass_no, portal_revoked: true } });
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}

// ---- rate plan / promo management (admin + consultant) -------------------

const CONFIG_ROLES = ["admin", "consultant"] as const;

export async function createRatePlan(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can manage rate plans." };
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const base_hours = parseInt(String(formData.get("base_hours") ?? "3"), 10) || 3;
  const base_rate = Number(String(formData.get("base_rate") ?? ""));
  const extra_hour_rate = Number(String(formData.get("extra_hour_rate") ?? "0")) || 0;
  if (!name) return { ok: false, error: "Name is required." };
  if (!Number.isFinite(base_rate) || base_rate < 0) return { ok: false, error: "Enter a base rate." };

  const { error } = await supabase.from("rate_plans").insert({ name, base_hours, base_rate, extra_hour_rate });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "A plan with that name already exists." };
    return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "rate_plans", entityId: name });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function updateRatePlan(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can manage rate plans." };
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const base_hours = parseInt(String(formData.get("base_hours") ?? "3"), 10) || 3;
  const base_rate = Number(String(formData.get("base_rate") ?? ""));
  const extra_hour_rate = Number(String(formData.get("extra_hour_rate") ?? "0")) || 0;
  if (!name) return { ok: false, error: "Name is required." };
  if (!Number.isFinite(base_rate) || base_rate < 0) return { ok: false, error: "Enter a base rate." };

  const { error } = await supabase.from("rate_plans").update({ name, base_hours, base_rate, extra_hour_rate }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "rate_plans", entityId: id, diff: { name, base_hours, base_rate, extra_hour_rate } });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function deactivateRatePlan(id: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can manage rate plans." };
  const supabase = await createClient();
  const { error } = await supabase.from("rate_plans").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "rate_plans", entityId: id });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function createPromo(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can manage promos." };
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const disc_type = String(formData.get("disc_type") ?? "percent");
  const disc_value = Number(String(formData.get("disc_value") ?? "0")) || 0;
  if (!name) return { ok: false, error: "Name is required." };
  if (!["percent", "amount"].includes(disc_type)) return { ok: false, error: "Invalid discount type." };

  const { error } = await supabase.from("promos").insert({ name, disc_type, disc_value });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "promos", entityId: name });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function updatePromo(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can manage promos." };
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const disc_type = String(formData.get("disc_type") ?? "percent");
  const disc_value = Number(String(formData.get("disc_value") ?? "0")) || 0;
  if (!name) return { ok: false, error: "Name is required." };
  if (!["percent", "amount"].includes(disc_type)) return { ok: false, error: "Invalid discount type." };

  const { error } = await supabase.from("promos").update({ name, disc_type, disc_value }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "promos", entityId: id, diff: { name, disc_type, disc_value } });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function deactivatePromo(id: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can manage promos." };
  const supabase = await createClient();
  const { error } = await supabase.from("promos").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "promos", entityId: id });
  revalidatePath("/hotel");
  return { ok: true };
}

// ---- room orders ---------------------------------------------------------
export async function addStayOrder(stayId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  const supabase = await createClient();
  const menu_item_id = String(formData.get("menu_item_id") ?? "").trim();
  const qty = Math.max(1, parseInt(String(formData.get("qty") ?? "1"), 10) || 1);
  if (!menu_item_id) return { ok: false, error: "Choose a menu item." };
  const { data: item } = await supabase.from("hotel_menu_items").select("name, price").eq("id", menu_item_id).maybeSingle();
  if (!item) return { ok: false, error: "Menu item not found." };
  const { error } = await supabase.from("stay_orders").insert({
    stay_id: stayId,
    menu_item_id,
    name: item.name,
    qty,
    unit_price: Number(item.price),
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "stay_orders", entityId: stayId, diff: { item: item.name, qty } });
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}

export async function removeStayOrder(orderId: string, stayId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  const supabase = await createClient();
  const { error } = await supabase.from("stay_orders").delete().eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "stay_orders", entityId: orderId });
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}

// ---- tax settings (admin / accounting) -----------------------------------
async function requireTaxManager() {
  const user = await requireAuth();
  return userHasAnyRole(user, ["admin", "accounting"]) ? user : null;
}
const VALID_TAX = ["none", "vat_inclusive", "non_vat"];

export async function setGlobalTax(tax_mode: string, tax_rate: number): Promise<ActionResult> {
  const user = await requireTaxManager();
  if (!user) return { ok: false, error: "Only admin or accounting can change tax settings." };
  if (!VALID_TAX.includes(tax_mode)) return { ok: false, error: "Invalid tax mode." };
  const supabase = await createClient();
  const { error } = await supabase.from("hotel_tax_settings").update({ tax_mode, tax_rate }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "hotel_tax_settings", entityId: "global", diff: { tax_mode, tax_rate } });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function setRoomTax(unitId: string, tax_mode: string, tax_rate: number): Promise<ActionResult> {
  const user = await requireTaxManager();
  if (!user) return { ok: false, error: "Only admin or accounting can change tax settings." };
  if (!VALID_TAX.includes(tax_mode)) return { ok: false, error: "Invalid tax mode." };
  const supabase = await createClient();
  const { error } = await supabase.from("room_tax").upsert({ unit_id: unitId, tax_mode, tax_rate }, { onConflict: "unit_id" });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "room_tax", entityId: unitId, diff: { tax_mode, tax_rate } });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function clearRoomTax(unitId: string): Promise<ActionResult> {
  const user = await requireTaxManager();
  if (!user) return { ok: false, error: "Not allowed." };
  const supabase = await createClient();
  await supabase.from("room_tax").delete().eq("unit_id", unitId);
  revalidatePath("/hotel");
  return { ok: true };
}

// ---- menu (admin) --------------------------------------------------------
export async function createMenuItem(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin"])) return { ok: false, error: "Only an admin can manage the menu." };
  const supabase = await createClient();
  const category = String(formData.get("category") ?? "Other").trim() || "Other";
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(String(formData.get("price") ?? "0")) || 0;
  if (!name) return { ok: false, error: "Item name is required." };
  const { error } = await supabase.from("hotel_menu_items").insert({ category, name, price });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "That item already exists." };
    return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "hotel_menu_items", entityId: name });
  revalidatePath("/hotel");
  return { ok: true };
}

/** Bulk-import / update rate plans from CSV (upsert by unique name). */
export async function bulkImportRatePlans(rows: Record<string, string>[]): Promise<ImportResult> {
  const user = await requireModuleWrite("hotel");
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 2000) return { ok: false, error: "Too many rows (max 2000)." };
  const admin = createAdminClient();
  const errors: { row: number; error: string }[] = [];
  const toUpsert: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const name = (r.name ?? "").trim();
    if (!name) { errors.push({ row: line, error: "name is required" }); continue; }
    const baseRate = Number(r.base_rate);
    if (!Number.isFinite(baseRate)) { errors.push({ row: line, error: "base_rate must be a number" }); continue; }
    toUpsert.push({
      name,
      base_hours: r.base_hours ? Math.trunc(Number(r.base_hours)) : 3,
      base_rate: baseRate,
      extra_hour_rate: r.extra_hour_rate ? Number(r.extra_hour_rate) : 0,
      sort_order: r.sort_order ? Math.trunc(Number(r.sort_order)) : 100,
    });
  }
  let inserted = 0;
  if (toUpsert.length) {
    const { error } = await admin.from("rate_plans").upsert(toUpsert, { onConflict: "name" });
    if (error) return { ok: false, error: error.message };
    inserted = toUpsert.length;
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "rate_plans", entityId: null, diff: { imported: inserted, skipped: errors.length } });
  revalidatePath("/hotel");
  return { ok: true, inserted, errors: errors.length ? errors : undefined };
}

/** Bulk-import / update hotel menu items from CSV (upsert by category+name). */
export async function bulkImportMenu(rows: Record<string, string>[]): Promise<ImportResult> {
  const user = await requireModuleWrite("hotel");
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 2000) return { ok: false, error: "Too many rows (max 2000)." };
  const admin = createAdminClient();
  const errors: { row: number; error: string }[] = [];
  const toUpsert: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const name = (r.name ?? "").trim();
    const category = (r.category ?? "Food").trim() || "Food";
    if (!name) { errors.push({ row: line, error: "name is required" }); continue; }
    const price = Number(r.price);
    if (!Number.isFinite(price)) { errors.push({ row: line, error: "price must be a number" }); continue; }
    toUpsert.push({ category, name, price, sort_order: r.sort_order ? Math.trunc(Number(r.sort_order)) : 100 });
  }
  let inserted = 0;
  if (toUpsert.length) {
    const { error } = await admin.from("hotel_menu_items").upsert(toUpsert, { onConflict: "category,name" });
    if (error) return { ok: false, error: error.message };
    inserted = toUpsert.length;
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "hotel_menu_items", entityId: null, diff: { imported: inserted, skipped: errors.length } });
  revalidatePath("/hotel");
  return { ok: true, inserted, errors: errors.length ? errors : undefined };
}

// ---- consultant-only hard deletes (testing / data cleanup) ---------------
const DEV_DELETE_ROLES = ["consultant"];

/** Hard-delete a stay and all cascaded records (payments, orders, extensions). */
export async function deleteStay(stayId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  if (!userHasAnyRole(user, DEV_DELETE_ROLES))
    return { ok: false, error: "Only consultant can delete stays." };
  const admin = createAdminClient();
  const { error } = await admin.from("stays").delete().eq("id", stayId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "stays", entityId: stayId });
  revalidatePath("/hotel");
  return { ok: true };
}

// ── Hotel shift handover ──────────────────────────────────────────────────────

const HANDOVER_ROLES = ["hotel_cashier", "hotel_rental_monitoring", "admin", "managing_officer"];
const MONITORING_ROLES = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant"];

/**
 * Cashier (or monitoring covering for absent cashier) submits the end-of-shift
 * bag handover. One record per shift_date — upsert so accidental double-taps
 * are idempotent.
 */
export async function submitShiftHandover(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, HANDOVER_ROLES))
    return { ok: false, error: "Only hotel cashier or monitoring can submit a shift handover." };

  const shift_date = String(formData.get("shift_date") ?? "").trim();
  if (!shift_date) return { ok: false, error: "Shift date is required." };

  const cashier_absent = formData.get("cashier_absent") === "on";
  const countedRaw = String(formData.get("counted_amount") ?? "").trim();
  const counted_amount = countedRaw ? Number(countedRaw) : null;
  if (counted_amount != null && (!Number.isFinite(counted_amount) || counted_amount < 0))
    return { ok: false, error: "Enter a valid counted amount." };

  let denomination_counts: Record<string, number> | null = null;
  const denomRaw = String(formData.get("denomination_counts") ?? "").trim();
  if (denomRaw) {
    try { denomination_counts = JSON.parse(denomRaw) as Record<string, number>; } catch { /* ignore */ }
  }

  const remarks = String(formData.get("remarks") ?? "").trim() || null;
  const cashier_role = user.roleKeys.find((r) => HANDOVER_ROLES.includes(r)) ?? "hotel_cashier";

  const admin = createAdminClient();
  const { error } = await admin.from("hotel_shift_handovers").upsert(
    {
      shift_date,
      cashier_user_id: user.userId,
      cashier_role,
      counted_amount,
      denomination_counts,
      remarks,
      cashier_absent,
      handed_over_at: new Date().toISOString(),
    },
    { onConflict: "shift_date" },
  );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "hotel_shift_handovers",
    entityId: shift_date,
    diff: { shift_date, cashier_absent, counted_amount },
  });

  // Notify monitoring that the bag is ready (only when cashier submits, not monitoring covering)
  if (!cashier_absent && user.roleKeys.includes("hotel_cashier")) {
    void createNotification({
      kind: "shift_handover_ready",
      title: `Hotel shift bag handed over — ${shift_date}`,
      body: counted_amount != null
        ? `Cashier counted ₱${counted_amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. Please count and build the transmittal.`
        : "Cashier did not count. Please count the bag and build the transmittal.",
      link: `/hotel/day?date=${shift_date}`,
      entityType: "hotel_shift_handover",
      entityId: shift_date,
      recipientRole: "hotel_rental_monitoring",
      createdBy: user.userId,
    });
  }

  revalidatePath("/hotel/day");
  return { ok: true };
}

/**
 * Monitoring counts the bag and builds the hotel shift transmittal.
 * Enters the custody chain at monitoring_recount (monitoring IS the counter).
 * All un-transmitted hotel collections for the shift_date are bundled.
 */
export async function buildHotelShiftTransmittal(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult & { transmittalId?: string }> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, MONITORING_ROLES))
    return { ok: false, error: "Only hotel & rental monitoring can build the shift transmittal." };

  const shift_date = String(formData.get("shift_date") ?? "").trim();
  if (!shift_date) return { ok: false, error: "Shift date is required." };

  // Compute counted_amount from the DenominationCounter JSON (no separate counted_amount field)
  let denomination_counts: Record<string, number> | null = null;
  let counted_amount = 0;
  const denomRaw = String(formData.get("denomination_counts") ?? "").trim();
  if (denomRaw) {
    try {
      const parsed = JSON.parse(denomRaw) as Record<string, number>;
      denomination_counts = parsed;
      counted_amount = Object.entries(parsed).reduce((s, [key, qty]) => {
        const val = Number(key.split("-").pop());
        return s + (isNaN(val) ? 0 : val) * (Number(qty) || 0);
      }, 0);
      counted_amount = Math.round(counted_amount * 100) / 100;
    } catch { /* ignore malformed */ }
  }

  const handover_id = String(formData.get("handover_id") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const admin = createAdminClient();

  // Fetch all untransmitted hotel collections for this shift date
  const { data: cols, error: cErr } = await admin
    .from("collections")
    .select("id, amount")
    .eq("business_line", "hotel")
    .eq("collected_on", shift_date)
    .is("transmittal_id", null);
  if (cErr) return { ok: false, error: cErr.message };
  if (!cols || cols.length === 0)
    return { ok: false, error: "No hotel collections found for this date to transmit." };

  const total = Math.round(cols.reduce((s, c) => s + Number(c.amount), 0) * 100) / 100;
  const variance = Math.round((counted_amount - total) * 100) / 100;
  const actor_role = user.roleKeys.find((r) => MONITORING_ROLES.includes(r)) ?? "hotel_rental_monitoring";

  // Create transmittal, entering custody at monitoring_recount
  const { data: t, error: tErr } = await admin
    .from("transmittals")
    .insert({
      transmittal_date: shift_date,
      total_amount: total,
      counted_by_role: actor_role,
      denomination_counts,
      counted_cash: counted_amount,
      payment_mode: "cash",
      transmittal_source: "hotel_cashier_shift",
      custody_stage: "monitoring_recount",
      status: "submitted",
      is_hotel_shift: true,
      handover_id,
      created_by: user.userId,
    })
    .select("id")
    .single();
  if (tErr) return { ok: false, error: tErr.message };

  const transmittalId = t.id as string;

  // Link all hotel collections to the transmittal
  const { error: uErr } = await admin
    .from("collections")
    .update({ transmittal_id: transmittalId })
    .in("id", cols.map((c) => c.id));
  if (uErr) return { ok: false, error: uErr.message };

  // Record the monitoring_recount custody step
  await admin.from("transmittal_custody").insert({
    transmittal_id: transmittalId,
    stage: "monitoring_recount",
    actor_user_id: user.userId,
    actor_role,
    counted_amount,
    expected_amount: total,
    variance,
    note,
  });

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "transmittals",
    entityId: transmittalId,
    diff: { shift_date, total, counted_amount, variance, count: cols.length, is_hotel_shift: true },
  });

  // Notify accounting that a hotel shift transmittal is ready for passbook
  void createNotification({
    kind: "transmittal_built",
    title: `Hotel shift transmittal ready — ${shift_date}`,
    body: `${cols.length} collection(s) · ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}${variance !== 0 ? ` · variance ₱${variance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : ""}`,
    link: `/transmittals/${transmittalId}`,
    entityType: "transmittal",
    entityId: transmittalId,
    recipientRole: "accounting",
    createdBy: user.userId,
  });

  revalidatePath("/hotel/day");
  revalidatePath("/transmittals");
  return { ok: true, transmittalId };
}

/** Hard-delete a single stay payment record. */
export async function deleteStayPayment(paymentId: string, stayId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  if (!userHasAnyRole(user, DEV_DELETE_ROLES))
    return { ok: false, error: "Only consultant can delete payments." };
  const admin = createAdminClient();
  const { error } = await admin.from("stay_payments").delete().eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "stay_payments", entityId: paymentId });
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}
