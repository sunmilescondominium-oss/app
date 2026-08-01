"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { roomCharge, promoDiscount } from "@/lib/hotel/rates";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";
import { HOTEL_PAYMENT_METHODS, CLEANING_CHECKLIST, ROOM_ASSET_CHECKLIST } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };
const METHODS: readonly string[] = HOTEL_PAYMENT_METHODS.map((m) => m.key);

export async function checkIn(
  unitId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
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
      created_by: user.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "stays",
    entityId: data.id as string,
    diff: { unitId, planned_hours },
  });
  revalidatePath("/hotel");
  return { ok: true };
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

  const { error } = await supabase.from("stay_payments").insert({
    stay_id: stayId,
    method,
    amount,
    receipt_no,
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
    .update({ status: "checked_out", check_out_at: new Date().toISOString() })
    .eq("id", stayId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };

  // Auto-create the post-checkout housekeeping task (service role).
  const { data: outStay } = await supabase.from("stays").select("unit_id").eq("id", stayId).maybeSingle();
  const hkAdmin = createAdminClient();
  const { data: hkTask } = await hkAdmin
    .from("housekeeping_tasks")
    .insert({
      unit_id: outStay?.unit_id ?? null,
      stay_id: stayId,
      status: "pending",
      checklist: CLEANING_CHECKLIST.map((c) => ({ key: c.key, label: c.label, done: false })),
    })
    .select("id")
    .single();
  if (hkTask) {
    await hkAdmin.from("housekeeping_events").insert({ task_id: hkTask.id, event_type: "created", detail: { via: "checkout" }, actor_user_id: user.userId });
  }

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
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "room_checks", entityId: stayId, diff: { gatepass_no } });
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}

// ---- rate plan / promo management (admin) --------------------------------
export async function createRatePlan(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin"]))
    return { ok: false, error: "Only an admin can manage rate plans." };
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const base_hours = parseInt(String(formData.get("base_hours") ?? "3"), 10) || 3;
  const base_rate = Number(String(formData.get("base_rate") ?? ""));
  const extra_hour_rate = Number(String(formData.get("extra_hour_rate") ?? "0")) || 0;
  if (!name) return { ok: false, error: "Name is required." };
  if (!Number.isFinite(base_rate) || base_rate < 0) return { ok: false, error: "Enter a base rate." };

  const { error } = await supabase.from("rate_plans").insert({ name, base_hours, base_rate, extra_hour_rate });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "A plan with that name exists." };
    return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "rate_plans", entityId: name });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function createPromo(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin"]))
    return { ok: false, error: "Only an admin can manage promos." };
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
