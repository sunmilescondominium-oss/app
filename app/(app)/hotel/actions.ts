"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAuth, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { roomCharge, promoDiscount, stayTotals, round2 } from "@/lib/hotel/rates";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila, peso } from "@/lib/collections/summary";
import { HOTEL_PAYMENT_METHODS, ROOM_ASSET_CHECKLIST } from "@/lib/config";
import { createCleaningTask } from "@/lib/housekeeping/create-task";
import { createNotification } from "@/lib/notifications/queries";
import type { ImportResult } from "@/lib/imports/types";
import { getActiveSession } from "@/lib/hotel/session";
import { checkReferralPlate, checkCouponNo } from "@/lib/guard/queries";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; error: string; shortfall: number; canForce: true };

async function getDisplayLabel(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("display_label").eq("id", userId).maybeSingle();
  return (data?.display_label as string) ?? "Unknown";
}

async function requireCashierOnDuty(userId: string): Promise<ActionResult | null> {
  // Demo mode bypasses the cashier-on-duty gate — no real data is written
  const cookieStore = await cookies();
  if (cookieStore.get("demo_mode")?.value === "1") return null;
  const session = await getActiveSession();
  if (!session) return { ok: false, error: "No cashier is currently on duty. A cashier must open their shift before hotel operations can proceed." };
  if (session.cashierUserId !== userId) return { ok: false, error: `${session.cashierName} is the cashier on duty. Only the on-duty cashier or a supervisor can process hotel transactions.` };
  return null;
}
const METHODS: readonly string[] = HOTEL_PAYMENT_METHODS.map((m) => m.key);

export type CheckInResult = { ok: true; stayId: string } | { ok: false; error: string };

export async function checkIn(
  unitId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<CheckInResult> {
  const user = await requireModuleWrite("hotel");
  const isSupervisor = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"]);
  if (!isSupervisor) {
    const gate = await requireCashierOnDuty(user.userId);
    if (gate) return gate as CheckInResult;
  }
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
  const discount_type_raw = String(formData.get("discount_type") ?? "").trim();
  const discount_type = (discount_type_raw === "pwd" || discount_type_raw === "senior_citizen") ? discount_type_raw : null;

  // Government discount requires an ID photo for audit.
  const photoFile = formData.get("discount_id_photo") as File | null;
  if (discount_type && (!photoFile || photoFile.size === 0)) {
    return { ok: false, error: "A photo of the government ID card is required to avail of the PWD or Senior Citizen discount." };
  }

  const rc0 = roomCharge(base_rate, extra_hour_rate, base_hours, planned_hours);
  let promo_discount_amount = 0;
  let promo_coupon_no: string | null = null;
  if (promo_id) {
    const { data: promo } = await supabase
      .from("promos")
      .select("disc_type, disc_value, requires_coupon, coupons_total")
      .eq("id", promo_id)
      .maybeSingle();
    if (promo) {
      // Promo discount is frozen to the initial booking charge — never recalculated on extensions
      promo_discount_amount = promoDiscount(rc0, promo.disc_type as string, Number(promo.disc_value));

      if (promo.requires_coupon) {
        const couponRaw = String(formData.get("promo_coupon_no") ?? "").trim().toUpperCase();
        if (!couponRaw) return { ok: false, error: "This promo requires a guard-issued coupon/card number." };

        // Check coupon limit
        if (promo.coupons_total != null) {
          const { count } = await supabase
            .from("hotel_stays")
            .select("id", { count: "exact", head: true })
            .eq("promo_id", promo_id)
            .not("promo_coupon_no", "is", null);
          if ((count ?? 0) >= Number(promo.coupons_total))
            return { ok: false, error: `All ${promo.coupons_total} coupons for this promo have been used.` };
        }

        // Guard must have recorded this coupon at the hotel gate
        const { data: winRow } = await createAdminClient().from("app_settings").select("value").eq("key", "referral_window_minutes").maybeSingle();
        const windowMin = parseInt(String(winRow?.value ?? "60"), 10);
        const couponFound = await checkCouponNo(couponRaw, windowMin);
        if (!couponFound)
          return { ok: false, error: `Coupon #${couponRaw} was not recorded by the guard at the hotel entrance. The guard must log it first.` };

        promo_coupon_no = couponRaw;
      }
    }
  }
  // PH government discount (PWD / Senior Citizen): 20% on total charge after promo — applies to initial hours AND all extensions
  let discount_amount = promo_discount_amount;
  if (discount_type) {
    const afterPromo = round2(rc0 - promo_discount_amount);
    discount_amount = round2(promo_discount_amount + afterPromo * 0.20);
  }

  // Extra persons — rate comes from the room (unit), not the global setting
  const extra_persons = Math.max(0, parseInt(String(formData.get("extra_persons") ?? "0"), 10) || 0);
  const guest_count = Math.max(
    1,
    parseInt(String(formData.get("guest_count") ?? "0"), 10) || (extra_persons + 1),
  );
  let extra_person_rate = 0;
  let extra_person_amount = 0;
  if (extra_persons > 0) {
    const adminExt = createAdminClient();
    const { data: unitRow } = await adminExt.from("units").select("extra_person_rate").eq("id", unitId).maybeSingle();
    extra_person_rate = Number(unitRow?.extra_person_rate ?? 0);
    extra_person_amount = round2(extra_persons * extra_person_rate);
  }

  // Pay-before-entry: the full room fee must be collected in advance at check-in.
  const requiredAdvance = round2(roomCharge(base_rate, extra_hour_rate, base_hours, planned_hours) - discount_amount + extra_person_amount);
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

  // Tag stay as demo if demo mode cookie is set.
  // In demo mode, enforce that the unit is a ghost demo room — real rooms must
  // never receive demo check-ins that could confuse the real room board.
  const cookieStoreForDemo = await cookies();
  const isDemo = cookieStoreForDemo.get("demo_mode")?.value === "1";
  if (isDemo) {
    const adminForDemoCheck = createAdminClient();
    const { data: unitRow } = await adminForDemoCheck.from("units").select("is_demo").eq("id", unitId).maybeSingle();
    if (!unitRow?.is_demo) {
      return { ok: false, error: "Demo mode: only DEMO rooms (DEMO-101, DEMO-201, DEMO-301) can be checked into during a demo session." };
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
      promo_discount_amount,
      promo_coupon_no,
      discount_amount,
      discount_type,
      tax_mode,
      tax_rate,
      guest_count,
      extra_persons,
      extra_person_rate,
      extra_person_amount,
      portal_token: (await import("node:crypto")).randomBytes(18).toString("base64url"),
      created_by: user.userId,
      is_demo: isDemo,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Upload government ID photo to private storage (48-hour audit copy).
  if (discount_type && photoFile && photoFile.size > 0) {
    try {
      const admin2 = createAdminClient();
      const bytes = await photoFile.arrayBuffer();
      const photoPath = `${data.id}.jpg`;
      await admin2.storage.from("discount-id-photos").upload(photoPath, Buffer.from(bytes), { contentType: "image/jpeg", upsert: true });
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await admin2.from("stays").update({ discount_id_photo_path: photoPath, discount_id_photo_expires_at: expiresAt }).eq("id", data.id);
    } catch {
      // Non-fatal: check-in proceeds even if photo upload fails; cashier should retake manually.
    }
  }

  // Record the advance payment + post to collections (initial receipt).
  const admin = createAdminClient();
  // Cashier enters AR/OR from physical booklet; fall back to auto-generated if blank.
  let ar_no = String(formData.get("advance_ar_no") ?? "").trim() || null;
  if (!ar_no) { const { data: seq } = await admin.rpc("next_receipt_no", { ctx: "hotel" }); ar_no = (seq as string | null); }
  let receipt_no = String(formData.get("advance_or_no") ?? "").trim();
  if (!receipt_no) receipt_no = `OR-${Date.now().toString(36).toUpperCase()}`;
  await admin.from("stay_payments").insert({ stay_id: data.id, method: advanceMethod, amount: advanceAmount, receipt_no, ar_no, created_by: user.userId });
  const collectorLabel = await getDisplayLabel(user.userId);
  await admin.from("collections").insert({
    business_line: "hotel", unit_id: unitId, amount: advanceAmount, or_number: receipt_no,
    payment_type: advanceMethod, collected_by_role: user.roleKeys.find((r) => ["hotel_cashier", "hotel_rental_monitoring"].includes(r)) ?? "hotel_cashier",
    collector_name: collectorLabel, ar_no,
    collected_on: todayManila(), remarks: "Hotel advance payment (check-in)",
  });

  // Referral — verify plate against guard entrance log (hotel gate only)
  const referralPlateRaw = String(formData.get("referral_plate") ?? "").trim();
  if (referralPlateRaw) {
    const { data: feeRow } = await admin.from("app_settings").select("value").eq("key", "referral_fee_hotel").maybeSingle();
    const { data: winRow } = await admin.from("app_settings").select("value").eq("key", "referral_window_minutes").maybeSingle();
    const referralFee = Number(feeRow?.value ?? 50);
    const windowMin = parseInt(winRow?.value ?? "60", 10);
    const check = await checkReferralPlate(referralPlateRaw, windowMin);
    if (!check.found) {
      // Hard block — referral cannot be paid without guard log confirmation
      await admin.from("stays").delete().eq("id", data.id as string);
      return { ok: false, error: `Referral plate "${referralPlateRaw.toUpperCase()}" was not found in the guard entrance log for the hotel gate in the last ${windowMin} minutes. Ask the guard to log the vehicle first, then retry check-in.` };
    }
    await admin.from("stay_referrals").insert({
      stay_id: data.id as string,
      guard_log_id: check.logId,
      plate_number: check.plateNumber,
      referral_amount: referralFee,
      verified: true,
      driver_id: check.driverId,
      created_by: user.userId,
    });
    // Link the guard log entry to this stay so it can't be reused
    if (check.logId) {
      await admin.from("guard_entrance_log").update({ linked_stay_id: data.id as string }).eq("id", check.logId);
    }
  }

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

  // Promo discount is frozen at check-in — never recalculated on extensions.
  // Only govt discount (PWD / Senior Citizen) scales with the new total room charge.
  const promo_discount_amount = Number(s.promo_discount_amount ?? 0);
  const newRc = roomCharge(Number(s.base_rate), Number(s.extra_hour_rate), s.base_hours as number, planned_hours);
  let discount_amount = promo_discount_amount;
  if (s.discount_type === "pwd" || s.discount_type === "senior_citizen") {
    discount_amount = round2(promo_discount_amount + round2((newRc - promo_discount_amount) * 0.20));
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
  const isSupervisor = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"]);
  if (!isSupervisor) {
    const gate = await requireCashierOnDuty(user.userId);
    if (gate) return gate;
  }
  const supabase = await createClient();

  const method = String(formData.get("method") ?? "cash");
  const amount = Number(String(formData.get("amount") ?? ""));
  if (!METHODS.includes(method)) return { ok: false, error: "Choose a payment method." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid amount." };

  let receipt_no = String(formData.get("receipt_no") ?? "").trim();
  if (!receipt_no) receipt_no = `OR-${Date.now().toString(36).toUpperCase()}`;

  // Cashier may override the AR from the physical booklet; fall back to sequence if blank.
  const adminForAr = createAdminClient();
  let ar_no = String(formData.get("ar_no") ?? "").trim() || null;
  if (!ar_no) { const { data: seq } = await adminForAr.rpc("next_receipt_no", { ctx: "hotel" }); ar_no = (seq as string | null); }

  // Compute itemized breakdown snapshot for this payment
  const admin0 = createAdminClient();
  const [{ data: stayFull }, { data: stayOrders }] = await Promise.all([
    admin0.from("stays")
      .select("unit_id, base_rate, extra_hour_rate, base_hours, planned_hours, extra_persons, extra_person_amount, discount_amount, discount_type, promo_discount_amount")
      .eq("id", stayId).maybeSingle(),
    admin0.from("stay_orders").select("name, qty, unit_price, menu_item_id").eq("stay_id", stayId),
  ]);
  const breakdown = stayFull ? (() => {
    const lines: { label: string; qty?: number; unit_price?: number; amount: number }[] = [];
    const rc = roomCharge(Number(stayFull.base_rate), Number(stayFull.extra_hour_rate), Number(stayFull.base_hours), Number(stayFull.planned_hours));
    lines.push({ label: `Room charge (${stayFull.planned_hours}h)`, amount: rc });
    if (Number(stayFull.extra_person_amount) > 0) {
      lines.push({ label: `Extra persons at check-in (${stayFull.extra_persons}×)`, amount: Number(stayFull.extra_person_amount) });
    }
    for (const o of stayOrders ?? []) {
      const oAmount = round2(Number(o.qty) * Number(o.unit_price));
      lines.push({
        label: o.menu_item_id ? String(o.name) : `Extra person added (${o.qty}×)`,
        qty: Number(o.qty),
        unit_price: Number(o.unit_price),
        amount: oAmount,
      });
    }
    const discount = round2((Number(stayFull.discount_amount) || 0) + (Number(stayFull.promo_discount_amount) || 0));
    if (discount > 0) lines.push({ label: "Discount", amount: -discount });
    const subtotal = round2(lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0));
    const total = round2(lines.reduce((s, l) => s + l.amount, 0));
    return { lines, subtotal, discount, total };
  })() : null;

  const { error } = await supabase.from("stay_payments").insert({
    stay_id: stayId,
    method,
    amount,
    receipt_no,
    ar_no,
    breakdown,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };

  // Post to collections so the payment flows into the daily dashboard + transmittal.
  const { data: stayRow } = stayFull ? { data: stayFull } : await supabase.from("stays").select("unit_id").eq("id", stayId).maybeSingle();
  const collectedRole =
    user.roleKeys.find((r) => ["hotel_cashier", "hotel_rental_monitoring"].includes(r)) ?? "hotel_cashier";
  const admin = createAdminClient();
  const collectorLabel = await getDisplayLabel(user.userId);
  await admin.from("collections").insert({
    business_line: "hotel",
    unit_id: stayRow?.unit_id ?? null,
    amount,
    or_number: receipt_no,
    ar_no,
    payment_type: method,
    collected_by_role: collectedRole,
    collector_name: collectorLabel,
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

export async function checkOut(
  stayId: string,
  shortStayType?: "test" | "early",
  shortStayReason?: string,
): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  const isSupervisor = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"]);
  if (!isSupervisor) {
    const gate = await requireCashierOnDuty(user.userId);
    if (gate) return gate;
  }
  const supabase = await createClient();

  const isTest = shortStayType === "test";

  // Balance check: if guest still owes money, block checkout and let cashier force it with a reason.
  if (!isTest) {
    const admin = createAdminClient();
    const [stayRes, paysRes, ordsRes] = await Promise.all([
      admin.from("stays").select("base_rate, extra_hour_rate, base_hours, planned_hours, discount_amount, extra_person_amount, check_in_at").eq("id", stayId).maybeSingle(),
      admin.from("stay_payments").select("amount").eq("stay_id", stayId),
      admin.from("stay_orders").select("qty, unit_price").eq("stay_id", stayId),
    ]);
    if (stayRes.data) {
      const paid = (paysRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const ordersTotal = (ordsRes.data ?? []).reduce((s, o) => s + Number(o.qty) * Number(o.unit_price), 0);
      const elapsedH = (Date.now() - new Date(stayRes.data.check_in_at as string).getTime()) / 3_600_000;
      const effHours = Math.max(stayRes.data.planned_hours as number, Math.ceil(elapsedH));
      const { balance } = stayTotals(
        { ...stayRes.data, planned_hours: effHours } as never,
        paid,
        ordersTotal,
      );
      if (balance > 0.01) {
        return { ok: false, error: `Balance of ${peso(balance)} must be settled before check-out.`, shortfall: round2(balance), canForce: true };
      }
    }
  }

  const extraFields: Record<string, unknown> = {};
  if (isTest) extraFields.voided_as_test = true;
  if (shortStayType === "early" && shortStayReason) extraFields.short_stay_reason = shortStayReason.trim();

  const { error } = await supabase
    .from("stays")
    .update({ status: "checked_out", check_out_at: new Date().toISOString(), portal_token: null, ...extraFields })
    .eq("id", stayId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };

  if (!isTest) {
    // Auto-create post-checkout housekeeping task (skip for test check-ins — room unchanged).
    const { data: outStay } = await supabase.from("stays").select("unit_id").eq("id", stayId).maybeSingle();
    await createCleaningTask({ unitId: outStay?.unit_id ?? null, stayId, actorUserId: user.userId, via: "checkout" });

    // Increment stays_after_fix counter for resolved maintenance issues on this unit.
    // When the counter reaches 5 the issue auto-expires from the room card.
    if (outStay?.unit_id) {
      const adminMaint = createAdminClient();
      const { data: resolvedIssues } = await adminMaint
        .from("hotel_maintenance_issues")
        .select("id, stays_after_fix")
        .eq("unit_id", outStay.unit_id)
        .eq("status", "resolved")
        .lt("stays_after_fix", 5);
      for (const issue of resolvedIssues ?? []) {
        await adminMaint
          .from("hotel_maintenance_issues")
          .update({ stays_after_fix: (issue.stays_after_fix as number) + 1 })
          .eq("id", issue.id as string);
      }
    }
  }

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "stays",
    entityId: stayId,
    diff: { status: "checked_out", shortStayType: shortStayType ?? "normal" },
  });
  revalidatePath("/hotel");
  revalidatePath(`/hotel/${stayId}`);
  revalidatePath("/housekeeping");
  return { ok: true };
}

/**
 * Force checkout when a shortfall exists.
 * Logs the reason, stamps the shortfall on the stay, notifies monitoring + admin.
 */
export async function checkOutForced(
  stayId: string,
  shortfallAmount: number,
  reason: string,
): Promise<ActionResult> {
  const user = await requireModuleWrite("hotel");
  const isSupervisor = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"]);
  if (!isSupervisor) {
    const gate = await requireCashierOnDuty(user.userId);
    if (gate) return gate;
  }
  const trimReason = reason.trim();
  if (!trimReason) return { ok: false, error: "A reason is required to force check-out with a shortfall." };
  if (shortfallAmount <= 0) return { ok: false, error: "Invalid shortfall amount." };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("stays")
    .update({
      status: "checked_out",
      check_out_at: now,
      portal_token: null,
      shortfall_amount: shortfallAmount,
      shortfall_reason: trimReason,
      shortfall_forced_at: now,
      shortfall_forced_by: user.userId,
    })
    .eq("id", stayId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };

  // Post-checkout housekeeping task
  const { data: outStay } = await supabase.from("stays").select("unit_id, guest_label").eq("id", stayId).maybeSingle();
  await createCleaningTask({ unitId: outStay?.unit_id ?? null, stayId, actorUserId: user.userId, via: "checkout" });

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "stays",
    entityId: stayId,
    diff: { status: "checked_out", shortfall_amount: shortfallAmount, shortfall_reason: trimReason, forced: true },
  });

  const actorLabel = await getDisplayLabel(user.userId);
  const guestLabel = outStay?.guest_label ?? "guest";
  const body = `${actorLabel} forced checkout for ${guestLabel} with a shortfall of ${peso(shortfallAmount)}. Reason: ${trimReason}. Cashier may be held accountable for the shortage.`;

  for (const role of ["hotel_rental_monitoring", "admin"] as const) {
    void createNotification({
      kind: "checkout_shortfall",
      title: `⚠️ Checkout shortfall — ${peso(shortfallAmount)} short`,
      body,
      link: `/hotel/${stayId}`,
      entityType: "stay",
      entityId: stayId,
      recipientRole: role,
      createdBy: user.userId,
    });
  }

  revalidatePath("/hotel");
  revalidatePath(`/hotel/${stayId}`);
  revalidatePath("/housekeeping");
  return { ok: true };
}

export async function adjustPaymentAR(
  paymentId: string,
  newArNo: string,
  newOrNo: string,
  reason: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "managing_officer", "accounting", "consultant"]))
    return { ok: false, error: "Only accounting/admin may adjust AR assignments." };

  const trimReason = reason.trim();
  if (!trimReason) return { ok: false, error: "A reason is required." };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("stay_payments")
    .select("id, ar_no, receipt_no")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { ok: false, error: "Payment not found." };

  const trimAr = newArNo.trim() || null;
  const trimOr = newOrNo.trim() || (payment.receipt_no as string | null);

  await admin.from("stay_payments").update({ ar_no: trimAr, receipt_no: trimOr }).eq("id", paymentId);
  await admin.from("hotel_ar_edits").insert({
    payment_id: paymentId,
    old_ar_no: (payment.ar_no as string | null) ?? null,
    new_ar_no: trimAr,
    old_or_no: (payment.receipt_no as string | null) ?? null,
    new_or_no: trimOr,
    reason: trimReason,
    edited_by: user.userId,
  });

  revalidatePath("/hotel/ar-register");
  revalidatePath("/hotel");
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

  const valid_from = String(formData.get("valid_from") ?? "").trim() || null;
  const valid_until = String(formData.get("valid_until") ?? "").trim() || null;
  const requires_coupon = formData.get("requires_coupon") === "true";
  const coupons_total_raw = String(formData.get("coupons_total") ?? "").trim();
  const coupons_total = coupons_total_raw ? parseInt(coupons_total_raw, 10) || null : null;
  const { error } = await supabase.from("promos").insert({ name, disc_type, disc_value, valid_from, valid_until, requires_coupon, coupons_total });
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

  const valid_from = String(formData.get("valid_from") ?? "").trim() || null;
  const valid_until = String(formData.get("valid_until") ?? "").trim() || null;
  const requires_coupon = formData.get("requires_coupon") === "true";
  const coupons_total_raw = String(formData.get("coupons_total") ?? "").trim();
  const coupons_total = coupons_total_raw ? parseInt(coupons_total_raw, 10) || null : null;
  const { error } = await supabase.from("promos").update({ name, disc_type, disc_value, valid_from, valid_until, requires_coupon, coupons_total }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "promos", entityId: id, diff: { name, disc_type, disc_value, valid_from, valid_until, requires_coupon, coupons_total } });
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

// ---- extra person rate setting (admin / consultant) -------------------------

export async function saveExtraPersonRate(rate: number): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "consultant"]))
    return { ok: false, error: "Only admin or consultant can set the extra person rate." };
  if (!Number.isFinite(rate) || rate < 0)
    return { ok: false, error: "Enter a valid rate (0 or more)." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("hotel_extra_settings")
    .upsert({ id: 1, extra_person_rate: rate, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "hotel_extra_settings", entityId: "singleton", diff: { extra_person_rate: rate } });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function saveUnitExtraPersonRate(unitId: string, rate: number): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "accounting", "hotel_rental_monitoring", "managing_officer", "consultant"]))
    return { ok: false, error: "Only admin, accounting, or hotel monitoring can set per-room extra person rates." };
  if (!Number.isFinite(rate) || rate < 0)
    return { ok: false, error: "Enter a valid rate (0 or more)." };
  const admin = createAdminClient();
  const { error } = await admin.from("units").update({ extra_person_rate: rate }).eq("id", unitId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "units", entityId: unitId, diff: { extra_person_rate: rate } });
  revalidatePath("/hotel");
  return { ok: true };
}

// ---- extra person charge (during stay) --------------------------------------

const EXTRA_PERSON_ROLES = ["hotel_cashier", "hotel_rental_monitoring", "admin", "managing_officer", "accounting", "consultant"] as const;

export async function addExtraPersonCharge(stayId: string, count: number, note: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...EXTRA_PERSON_ROLES]))
    return { ok: false, error: "Not authorised to add extra person charges." };
  if (!Number.isInteger(count) || count < 1)
    return { ok: false, error: "Count must be at least 1." };
  const admin = createAdminClient();
  // Get the stay's unit to read its per-room extra person rate
  const { data: stayRow } = await admin.from("stays").select("unit_id").eq("id", stayId).maybeSingle();
  if (!stayRow?.unit_id) return { ok: false, error: "Stay or unit not found." };
  const { data: unitRow } = await admin.from("units").select("extra_person_rate").eq("id", stayRow.unit_id).maybeSingle();
  const rate = Number(unitRow?.extra_person_rate ?? 0);
  if (rate <= 0) return { ok: false, error: "Extra person rate is not configured for this room. Ask admin, accounting, or hotel monitoring to set it." };
  const label = note.trim() ? `Extra person — ${note.trim()}` : "Extra person";
  const { error } = await admin.from("stay_orders").insert({
    stay_id: stayId,
    menu_item_id: null,
    name: label,
    qty: count,
    unit_price: rate,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "stay_extra_person_charge", entityId: stayId, diff: { count, rate, note } });
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}

export async function removeExtraPersonCharge(chargeId: string, stayId: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...EXTRA_PERSON_ROLES]))
    return { ok: false, error: "Not authorised to remove extra person charges." };
  const admin = createAdminClient();
  const { error } = await admin.from("stay_orders").delete().eq("id", chargeId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "stay_extra_person_charge", entityId: chargeId });
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}

// ---- gate entry authorization (cashier signals guard that fee is collected) --

export async function authorizeGateEntry(personEventId: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...EXTRA_PERSON_ROLES]))
    return { ok: false, error: "Not authorised to authorize gate entry." };
  if (!personEventId) return { ok: false, error: "Invalid event ID." };

  const admin = createAdminClient();

  const { data: ev } = await admin
    .from("hotel_stay_person_events")
    .select("id, stay_id, fee_collected_at, confirmed_at")
    .eq("id", personEventId)
    .maybeSingle();

  if (!ev) return { ok: false, error: "Gate entry event not found." };
  if (ev.fee_collected_at) return { ok: false, error: "Already authorized." };
  if (ev.confirmed_at) return { ok: false, error: "Entry already confirmed by guard." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("hotel_stay_person_events")
    .update({
      fee_collected_at: now,
      fee_collected_by: user.userId,
      event_type: "fee_collected",
    })
    .eq("id", personEventId);
  if (error) return { ok: false, error: error.message };

  // Resolve matching guard alert
  await admin
    .from("hotel_guard_alerts")
    .update({ resolved: true, resolved_at: now, resolved_by: user.userId })
    .eq("stay_id", ev.stay_id as string)
    .eq("alert_type", "additional_person")
    .eq("resolved", false);

  revalidatePath("/hotel");
  revalidatePath(`/hotel/${ev.stay_id as string}`);
  return { ok: true };
}

// ---- room transfer ----------------------------------------------------------

const TRANSFER_REASONS = ["room_issue", "maintenance", "guest_preference", "other"] as const;

export async function transferRoom(
  stayId: string,
  formData: FormData,
): Promise<ActionResult & { newStayId?: string }> {
  const user = await requireModuleWrite("hotel");
  const isSupervisor = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"]);
  if (!isSupervisor) {
    const gate = await requireCashierOnDuty(user.userId);
    if (gate) return gate as ActionResult & { newStayId?: string };
  }

  const toUnitId = String(formData.get("to_unit_id") ?? "").trim();
  const reason = String(formData.get("transfer_reason") ?? "").trim() as typeof TRANSFER_REASONS[number];
  const remarks = String(formData.get("remarks") ?? "").trim() || null;
  const newBaseRate = parseFloat(String(formData.get("new_base_rate") ?? "0")) || null;
  if (!toUnitId) return { ok: false, error: "Select the room to transfer to." };
  if (!TRANSFER_REASONS.includes(reason)) return { ok: false, error: "Select a valid transfer reason." };

  const admin = createAdminClient();
  const { data: stay } = await admin.from("stays").select("*").eq("id", stayId).maybeSingle();
  if (!stay) return { ok: false, error: "Stay not found." };
  if ((stay.status as string) !== "active") return { ok: false, error: "Stay is not active." };
  if ((stay.unit_id as string) === toUnitId) return { ok: false, error: "Cannot transfer to the same room." };

  // Target room must be clean and unoccupied
  const [{ data: occupied }, { data: hk }] = await Promise.all([
    admin.from("stays").select("id").eq("unit_id", toUnitId).eq("status", "active").limit(1).maybeSingle(),
    admin.from("housekeeping_tasks").select("id").eq("unit_id", toUnitId).in("status", ["pending", "in_progress"]).limit(1).maybeSingle(),
  ]);
  if (occupied) return { ok: false, error: "Target room is already occupied." };
  if (hk) return { ok: false, error: "Target room needs housekeeping before it can be occupied." };

  // Determine time-since-checkin to apply timer rule
  const checkInMs = new Date(stay.check_in_at as string).getTime();
  const elapsedMs = Date.now() - checkInMs;
  const WITHIN_10_MIN = elapsedMs <= 10 * 60 * 1000;

  // New check_in_at: within 10 min → reset to now; after 10 min → original + 5 extra min
  const newCheckInAt = WITHIN_10_MIN
    ? new Date().toISOString()
    : new Date(checkInMs + 5 * 60 * 1000).toISOString();

  // Create the new stay at the target room (copy all relevant rate snapshot fields)
  const { data: newStay, error: insErr } = await admin.from("stays").insert({
    unit_id: toUnitId,
    guest_label: stay.guest_label,
    guest_contact: stay.guest_contact,
    rate_plan_id: stay.rate_plan_id,
    planned_hours: stay.planned_hours,
    base_hours: stay.base_hours,
    base_rate: newBaseRate ?? stay.base_rate,
    extra_hour_rate: stay.extra_hour_rate,
    promo_id: stay.promo_id,
    discount_amount: stay.discount_amount,
    discount_type: stay.discount_type,
    tax_mode: stay.tax_mode,
    tax_rate: stay.tax_rate,
    extra_persons: stay.extra_persons,
    extra_person_rate: stay.extra_person_rate,
    extra_person_amount: stay.extra_person_amount,
    check_in_at: newCheckInAt,
    status: "active",
    created_by: user.userId,
    transfer_from_stay_id: stayId,
    portal_token: (await import("node:crypto")).randomBytes(18).toString("base64url"),
  }).select("id").single();
  if (insErr) return { ok: false, error: insErr.message };

  // Move existing payments to new stay
  await admin.from("stay_payments").update({ stay_id: newStay.id as string }).eq("stay_id", stayId);

  // Collect upgrade fee if provided
  const upgradeAmount = parseFloat(String(formData.get("upgrade_amount") ?? "0")) || 0;
  const upgradeMethod = String(formData.get("upgrade_method") ?? "").trim();
  if (upgradeAmount > 0 && METHODS.includes(upgradeMethod)) {
    const arNo = String(formData.get("upgrade_ar_no") ?? "").trim() || null;
    await admin.from("stay_payments").insert({
      stay_id: newStay.id as string,
      amount: round2(upgradeAmount),
      method: upgradeMethod,
      ar_no: arNo,
      created_by: user.userId,
      payment_note: `Upgrade fee — transferred from room ${stay.unit_id as string}`,
    });
  }

  // Check out the old stay (mark as voided-transfer so it's not confused with real checkouts)
  await admin.from("stays").update({ status: "checked_out", check_out_at: new Date().toISOString(), portal_token: null }).eq("id", stayId);

  // Record the transfer
  const { data: transferRecord } = await admin.from("hotel_room_transfers").insert({
    from_stay_id: stayId,
    to_stay_id: newStay.id as string,
    from_unit_id: stay.unit_id as string,
    to_unit_id: toUnitId,
    within_10_min: WITHIN_10_MIN,
    transfer_reason: reason,
    remarks,
    performed_by: user.userId,
  }).select("id").single();

  // Auto-create maintenance issue when the transfer reason is room_issue or maintenance
  const maintenanceDescription = String(formData.get("maintenance_description") ?? "").trim();
  if ((reason === "room_issue" || reason === "maintenance") && maintenanceDescription) {
    const reporterName = await getDisplayLabel(user.userId);
    await admin.from("hotel_maintenance_issues").insert({
      unit_id: stay.unit_id as string,
      transfer_id: (transferRecord?.id as string) ?? null,
      description: maintenanceDescription,
      reported_by: user.userId,
      reporter_name: reporterName,
    });
  }

  // Notify admin + monitoring of the transfer (potential maintenance flag)
  void createNotification({
    kind: "room_transfer",
    title: `Room transfer — ${stay.guest_label}`,
    body: `Transferred from ${stay.unit_id} to ${toUnitId}. Reason: ${reason}${remarks ? ` — ${remarks}` : ""}`,
    link: `/hotel/${newStay.id as string}`,
    entityType: "hotel_room_transfer",
    entityId: stayId,
    recipientRole: "hotel_rental_monitoring",
    createdBy: user.userId,
  });

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "stays",
    entityId: stayId,
    diff: { transferred_to: toUnitId, within_10_min: WITHIN_10_MIN, reason, newStayId: newStay.id as string },
  });

  revalidatePath("/hotel");
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true, newStayId: newStay.id as string };
}

// ---- void / cancel check-in (supervisor) ------------------------------------

const SUPERVISOR_ROLES = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant"];

export async function voidStay(stayId: string, reason: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, SUPERVISOR_ROLES))
    return { ok: false, error: "Only supervisors can void a stay." };
  if (!reason.trim()) return { ok: false, error: "A reason is required to void a stay." };

  const admin = createAdminClient();
  const { data: stay } = await admin.from("stays").select("id, status, unit_id").eq("id", stayId).maybeSingle();
  if (!stay) return { ok: false, error: "Stay not found." };
  if ((stay.status as string) !== "active") return { ok: false, error: "Only active stays can be voided." };

  const actorLabel = await getDisplayLabel(user.userId);

  await admin.from("stays").update({ status: "voided", check_out_at: new Date().toISOString(), portal_token: null }).eq("id", stayId);
  await admin.from("hotel_stay_voids").insert({
    stay_id: stayId,
    void_type: "cancel_checkin",
    reason: reason.trim(),
    voided_by: user.userId,
    voider_name: actorLabel,
  });

  // Auto-create housekeeping task so the room gets cleaned after the void
  await createCleaningTask({ unitId: stay.unit_id as string | null, stayId, actorUserId: user.userId, via: "checkout" });

  // Alert admin/monitoring if guard already confirmed this guest entered
  const adminForAlert = createAdminClient();
  const { data: guardLog } = await adminForAlert
    .from("guard_entrance_log")
    .select("id, plate_number")
    .eq("linked_stay_id", stayId)
    .maybeSingle();
  if (guardLog) {
    const unitRow = await adminForAlert.from("units").select("unit_number").eq("id", stay.unit_id as string).maybeSingle();
    const unitNo = unitRow.data?.unit_number ?? "unknown";
    const alertBody = `Room ${unitNo} voided by ${actorLabel} — Reason: ${reason.trim()}. Guard had logged vehicle${guardLog.plate_number ? ` (${guardLog.plate_number})` : ""} entering. Verify cash.`;
    for (const role of ["admin", "hotel_rental_monitoring", "owner"] as const) {
      void createNotification({ kind: "stay_void_after_guard", title: "⚠️ Stay voided after guard entry", body: alertBody, link: `/hotel/${stayId}`, entityType: "stay", entityId: stayId, recipientRole: role, createdBy: user.userId });
    }
  }

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "stays",
    entityId: stayId,
    diff: { voided: true, reason: reason.trim() },
  });

  revalidatePath("/hotel");
  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}

// ---- delete / void extension (supervisor) -----------------------------------

// ── Maintenance issues ────────────────────────────────────────────────────────

const MAINTENANCE_ROLES = [
  "hotel_rental_monitoring", "admin", "managing_officer", "consultant", "room_attendant",
] as const;

export async function resolveMaintenanceIssue(issueId: string, fixReport: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...MAINTENANCE_ROLES]))
    return { ok: false, error: "Not authorised to resolve maintenance issues." };
  if (!fixReport.trim()) return { ok: false, error: "Fix report is required." };

  const admin = createAdminClient();
  const resolverName = await getDisplayLabel(user.userId);
  // Issue stays visible for 1 month OR 5 uses, whichever comes first.
  const visibleUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("hotel_maintenance_issues").update({
    status: "resolved",
    resolved_by: user.userId,
    resolver_name: resolverName,
    resolved_at: new Date().toISOString(),
    fix_report: fixReport.trim(),
    stays_after_fix: 0,
    visible_until: visibleUntil,
  }).eq("id", issueId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "hotel_maintenance_issues", entityId: issueId, diff: { status: "resolved" } });
  revalidatePath("/hotel");
  return { ok: true };
}

export async function updateMaintenanceIssueStatus(issueId: string, status: "open" | "in_progress"): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...MAINTENANCE_ROLES]))
    return { ok: false, error: "Not authorised." };
  const admin = createAdminClient();
  const { error } = await admin.from("hotel_maintenance_issues").update({ status }).eq("id", issueId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hotel");
  return { ok: true };
}

// ── Demo data cleanup ─────────────────────────────────────────────────────────

const DEMO_CLEAR_ROLES = [
  "consultant", "admin", "managing_officer", "hotel_rental_monitoring", "accounting",
] as const;

/**
 * Hard-delete all demo data:
 *  1. housekeeping events → tasks for ghost demo rooms
 *  2. demo stays (cascade removes payments, orders, extensions, transfers)
 *  3. Reset demo room statuses back to available
 */
export async function clearDemoData(): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...DEMO_CLEAR_ROLES]))
    return { ok: false, error: "Not authorised to clear demo data." };
  const admin = createAdminClient();

  // 1. Get demo unit IDs
  const { data: demoUnits } = await admin.from("units").select("id").eq("is_demo", true);
  const demoUnitIds = (demoUnits ?? []).map((u) => (u as Record<string, unknown>).id as string);

  if (demoUnitIds.length) {
    // 2. Delete HK events then tasks for demo rooms
    const { data: demoTasks } = await admin.from("housekeeping_tasks").select("id").in("unit_id", demoUnitIds);
    const demoTaskIds = (demoTasks ?? []).map((t) => (t as Record<string, unknown>).id as string);
    if (demoTaskIds.length) {
      await admin.from("housekeeping_events").delete().in("task_id", demoTaskIds);
      await admin.from("housekeeping_tasks").delete().in("id", demoTaskIds);
    }
    // 3. Reset demo room statuses
    await admin.from("units").update({ status: "available" }).in("id", demoUnitIds);
  }

  // 4. Delete demo stays (cascade removes payments, orders, etc.)
  const { error } = await admin.from("stays").delete().eq("is_demo", true);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "stays", entityId: "demo_batch", diff: { is_demo: true } });
  revalidatePath("/hotel");
  revalidatePath("/housekeeping");
  return { ok: true };
}

export async function deleteExtension(
  extensionId: string,
  stayId: string,
  reason: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, SUPERVISOR_ROLES))
    return { ok: false, error: "Only supervisors can delete an extension." };
  if (!reason.trim()) return { ok: false, error: "A reason is required." };

  const admin = createAdminClient();
  const { data: ext } = await admin.from("stay_extensions").select("id, stay_id, added_hours").eq("id", extensionId).maybeSingle();
  if (!ext) return { ok: false, error: "Extension not found." };

  // Revert the planned_hours on the parent stay
  const { data: stay } = await admin.from("stays").select("planned_hours, base_hours").eq("id", stayId).maybeSingle();
  if (stay) {
    const restoredHours = Math.max(stay.base_hours as number, (stay.planned_hours as number) - (ext.added_hours as number));
    await admin.from("stays").update({ planned_hours: restoredHours }).eq("id", stayId);
  }

  const actorLabel = await getDisplayLabel(user.userId);
  await admin.from("hotel_stay_voids").insert({
    stay_id: stayId,
    void_type: "delete_extension",
    extension_id: extensionId,
    reason: reason.trim(),
    voided_by: user.userId,
    voider_name: actorLabel,
  });

  await admin.from("stay_extensions").delete().eq("id", extensionId);

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "delete",
    entity: "stay_extensions",
    entityId: extensionId,
    diff: { stayId, reason: reason.trim() },
  });

  revalidatePath(`/hotel/${stayId}`);
  return { ok: true };
}
