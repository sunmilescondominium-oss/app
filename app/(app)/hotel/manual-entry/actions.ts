"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SUPERVISOR_ROLES = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"];

export async function recordManualHotelStay(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModule("hotel");
  if (!user.roleKeys.some((r) => SUPERVISOR_ROLES.includes(r))) {
    return { ok: false, error: "You do not have permission to record manual hotel entries." };
  }

  const unit_id           = String(formData.get("unit_id") ?? "").trim();
  const guest_label       = String(formData.get("guest_label") ?? "").trim() || "Guest";
  const guest_contact     = String(formData.get("guest_contact") ?? "").trim() || null;
  const check_in_raw      = String(formData.get("check_in_at") ?? "").trim();
  const check_out_raw     = String(formData.get("check_out_at") ?? "").trim();
  const room_rate         = Number(formData.get("room_rate") ?? 0);
  const guest_count       = Math.max(1, Number(formData.get("guest_count") ?? 1));
  const ext_hours         = Math.max(0, Number(formData.get("ext_hours") ?? 0));
  const ext_rate          = Math.max(0, Number(formData.get("ext_rate") ?? 0));
  const extra_persons     = Math.max(0, Number(formData.get("extra_persons") ?? 0));
  const extra_person_rate = Math.max(0, Number(formData.get("extra_person_rate") ?? 0));
  const amount            = Number(formData.get("amount") ?? 0);
  const method            = String(formData.get("method") ?? "cash").trim();
  const ar_no_raw         = String(formData.get("ar_no") ?? "").trim() || null;
  const or_no_raw         = String(formData.get("or_no") ?? "").trim() || null;
  const remarks           = String(formData.get("remarks") ?? "").trim() || null;
  const item_count        = Number(formData.get("item_count") ?? 0);

  if (!unit_id)       return { ok: false, error: "Select a room." };
  if (!check_in_raw)  return { ok: false, error: "Check-in date/time is required." };
  if (!check_out_raw) return { ok: false, error: "Check-out date/time is required." };
  if (!remarks)       return { ok: false, error: "Remarks are required for manual offline entries." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Amount must be a valid number." };

  const check_in_at  = new Date(check_in_raw).toISOString();
  const check_out_at = new Date(check_out_raw).toISOString();
  if (new Date(check_out_at) <= new Date(check_in_at)) {
    return { ok: false, error: "Check-out must be after check-in." };
  }

  // Parse incidental line items
  const incidentals: { description: string; amount: number }[] = [];
  for (let i = 0; i < item_count; i++) {
    const desc   = String(formData.get(`item_desc_${i}`) ?? "").trim();
    const itemAmt = Number(formData.get(`item_amount_${i}`) ?? 0);
    if (desc && Number.isFinite(itemAmt) && itemAmt > 0) {
      incidentals.push({ description: desc, amount: itemAmt });
    }
  }

  const admin = createAdminClient();

  const { data: unit } = await admin.from("units").select("id, unit_number").eq("id", unit_id).maybeSingle();
  if (!unit) return { ok: false, error: "Room not found." };

  const extra_person_amount = extra_persons * extra_person_rate;
  const ext_amount          = ext_hours * ext_rate;
  // planned_hours = duration from timestamps (in hours, rounded)
  const planned_hours = Math.round(
    (new Date(check_out_at).getTime() - new Date(check_in_at).getTime()) / 3_600_000
  );

  // Create already-completed stay (status = checked_out)
  const { data: stay, error: stayErr } = await admin.from("stays").insert({
    unit_id,
    guest_label,
    guest_contact,
    guest_count,
    check_in_at,
    check_out_at,
    status:              "checked_out",
    // Room charge stored as base_rate; server doesn't apply rate-plan logic
    base_rate:           room_rate,
    base_hours:          planned_hours,
    planned_hours,
    extra_hour_rate:     ext_rate,
    tax_mode:            "inclusive",
    tax_rate:            0,
    extra_persons,
    extra_person_rate,
    extra_person_amount,
    discount_amount:     0,
    promo_discount_amount: 0,
    remarks,
    is_manual_entry:     true,
    created_by:          user.userId,
    is_demo:             false,
  }).select("id").single();
  if (stayErr) return { ok: false, error: stayErr.message };

  const stayId = (stay as Record<string, unknown>).id as string;

  // Time extension record
  if (ext_hours > 0) {
    await admin.from("stay_extensions").insert({
      stay_id:     stayId,
      added_hours: ext_hours,
    });
  }

  // Incidental orders
  if (incidentals.length > 0) {
    const orderRows = incidentals.map((inc) => ({
      stay_id:    stayId,
      name:       inc.description,
      qty:        1,
      unit_price: inc.amount,
      created_by: user.userId,
    }));
    const { error: ordErr } = await admin.from("stay_orders").insert(orderRows);
    if (ordErr) return { ok: false, error: ordErr.message };
  }

  // AR / OR numbers
  let ar_no = ar_no_raw;
  if (!ar_no) {
    const { data: seq } = await admin.rpc("next_receipt_no", { ctx: "hotel" });
    ar_no = (seq as string | null) ?? `AR-MANUAL-${Date.now().toString(36).toUpperCase()}`;
  }
  const or_no = or_no_raw ?? `OR-MANUAL-${Date.now().toString(36).toUpperCase()}`;

  // Payment record
  if (amount > 0) {
    const { error: payErr } = await admin.from("stay_payments").insert({
      stay_id:    stayId,
      method,
      amount,
      receipt_no: or_no,
      ar_no,
      created_by: user.userId,
    });
    if (payErr) return { ok: false, error: payErr.message };

    // Collection record (so it appears in transmittals)
    const { error: colErr } = await admin.from("collections").insert({
      business_line:       "hotel",
      unit_id,
      amount,
      or_number:           or_no,
      payment_type:        method,
      collected_by_role:   user.roleKeys.find((r) => SUPERVISOR_ROLES.includes(r)) ?? "hotel_rental_monitoring",
      collector_name:      guest_label,
      ar_no,
      collected_on:        check_in_raw.slice(0, 10),
      remarks:             `Manual offline entry — ${remarks}`,
    });
    if (colErr) return { ok: false, error: colErr.message };
  }

  await logAudit({
    actorUserId: user.userId,
    actorRoles:  user.roleKeys,
    action:      "create",
    entity:      "stays",
    entityId:    stayId,
    diff: {
      manual:       true,
      unit_id,
      check_in_at,
      check_out_at,
      room_rate,
      ext_hours,
      extra_persons,
      incidentals:  incidentals.length,
      amount,
      ar_no,
    },
  });

  revalidatePath("/hotel");
  revalidatePath("/hotel/performance");
  revalidatePath("/hotel/collection-report");
  revalidatePath("/hotel/ar-register");
  return { ok: true };
}
