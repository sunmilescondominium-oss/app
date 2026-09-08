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

  const unit_id       = String(formData.get("unit_id") ?? "").trim();
  const guest_label   = String(formData.get("guest_label") ?? "").trim() || "Guest";
  const guest_contact = String(formData.get("guest_contact") ?? "").trim() || null;
  const check_in_raw  = String(formData.get("check_in_at") ?? "").trim();
  const check_out_raw = String(formData.get("check_out_at") ?? "").trim();
  const amount        = Number(formData.get("amount") ?? "");
  const method        = String(formData.get("method") ?? "cash").trim();
  const ar_no_raw     = String(formData.get("ar_no") ?? "").trim() || null;
  const or_no_raw     = String(formData.get("or_no") ?? "").trim() || null;
  const remarks       = String(formData.get("remarks") ?? "").trim() || null;

  if (!unit_id)       return { ok: false, error: "Select a room." };
  if (!check_in_raw)  return { ok: false, error: "Check-in date/time is required." };
  if (!check_out_raw) return { ok: false, error: "Check-out date/time is required." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Amount must be a valid number." };

  const check_in_at  = new Date(check_in_raw).toISOString();
  const check_out_at = new Date(check_out_raw).toISOString();
  if (new Date(check_out_at) <= new Date(check_in_at)) {
    return { ok: false, error: "Check-out must be after check-in." };
  }

  const admin = createAdminClient();

  const { data: unit } = await admin.from("units").select("id, unit_number").eq("id", unit_id).maybeSingle();
  if (!unit) return { ok: false, error: "Room not found." };

  // Create already-completed stay (status = checked_out)
  const { data: stay, error: stayErr } = await admin.from("stays").insert({
    unit_id,
    guest_label,
    guest_contact,
    check_in_at,
    check_out_at,
    status: "checked_out",
    base_rate: 0,       // not rate-plan based — amount is the total collected
    base_hours: 0,
    planned_hours: 0,
    extra_hour_rate: 0,
    tax_mode: "inclusive",
    tax_rate: 0,
    guest_count: 1,
    extra_persons: 0,
    extra_person_rate: 0,
    extra_person_amount: 0,
    discount_amount: 0,
    promo_discount_amount: 0,
    remarks,
    created_by: user.userId,
    is_demo: false,
  }).select("id").single();
  if (stayErr) return { ok: false, error: stayErr.message };

  const stayId = (stay as Record<string, unknown>).id as string;

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
      stay_id: stayId,
      method,
      amount,
      receipt_no: or_no,
      ar_no,
      created_by: user.userId,
    });
    if (payErr) return { ok: false, error: payErr.message };

    // Collection record (so it appears in transmittals)
    const { error: colErr } = await admin.from("collections").insert({
      business_line: "hotel",
      unit_id,
      amount,
      or_number: or_no,
      payment_type: method,
      collected_by_role: user.roleKeys.find((r) => SUPERVISOR_ROLES.includes(r)) ?? "hotel_rental_monitoring",
      collector_name: guest_label,
      ar_no,
      collected_on: check_in_raw.slice(0, 10),
      remarks: `Manual offline entry${remarks ? " — " + remarks : ""}`,
    });
    if (colErr) return { ok: false, error: colErr.message };
  }

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "stays",
    entityId: stayId,
    diff: { manual: true, unit_id, check_in_at, check_out_at, amount, ar_no },
  });

  revalidatePath("/hotel");
  revalidatePath("/hotel/performance");
  revalidatePath("/hotel/collection-report");
  revalidatePath("/hotel/ar-register");
  return { ok: true };
}
