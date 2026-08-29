"use server";

import { requireModule } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function startShift(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModule("guard");
  const postId = String(formData.get("post_id") ?? "").trim();
  const shiftType = String(formData.get("shift_type") ?? "").trim();
  if (!postId) return { ok: false, error: "Select a guard post." };
  if (shiftType !== "day" && shiftType !== "night")
    return { ok: false, error: "Select shift type." };

  const admin = createAdminClient();
  // End any previously open shift for this guard
  await admin
    .from("guard_shifts")
    .update({ ended_at: new Date().toISOString() })
    .eq("guard_id", user.userId)
    .is("ended_at", null);

  const { error } = await admin.from("guard_shifts").insert({
    guard_id: user.userId,
    post_id: postId,
    shift_type: shiftType,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard");
  return { ok: true };
}

export async function endShift(shiftId: string): Promise<ActionResult> {
  const user = await requireModule("guard");
  const admin = createAdminClient();
  const { error } = await admin
    .from("guard_shifts")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", shiftId)
    .eq("guard_id", user.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard");
  return { ok: true };
}

export async function logEntry(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModule("guard");
  const admin = createAdminClient();

  const entryType = String(formData.get("entry_type") ?? "guest").trim();
  const vehicleType = String(formData.get("vehicle_type") ?? "").trim() || null;
  const plateRaw = String(formData.get("plate_number") ?? "").trim();
  const plateNumber = plateRaw ? plateRaw.toUpperCase().replace(/\s+/g, " ") : null;
  const driverName = String(formData.get("driver_name") ?? "").trim() || null;
  const passengerCountRaw = parseInt(String(formData.get("passenger_count") ?? ""), 10);
  const passengerCount = Number.isFinite(passengerCountRaw) && passengerCountRaw > 0
    ? passengerCountRaw : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const discountCouponNo = String(formData.get("discount_coupon_no") ?? "").trim().toUpperCase() || null;

  // Get active shift to link
  const { data: shift } = await admin
    .from("guard_shifts")
    .select("id, post_id")
    .eq("guard_id", user.userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return { ok: false, error: "You must start a shift before logging entries." };

  const { error } = await admin.from("guard_entrance_log").insert({
    post_id: shift.post_id as string,
    guard_shift_id: shift.id as string,
    logged_by: user.userId,
    entry_type: entryType,
    vehicle_type: vehicleType,
    plate_number: plateNumber,
    driver_name: driverName,
    passenger_count: passengerCount,
    notes,
    discount_coupon_no: discountCouponNo,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard");
  return { ok: true };
}

export async function logExit(logId: string): Promise<ActionResult> {
  await requireModule("guard");
  const admin = createAdminClient();
  const { error } = await admin
    .from("guard_entrance_log")
    .update({ time_out: new Date().toISOString() })
    .eq("id", logId)
    .is("time_out", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard");
  return { ok: true };
}
