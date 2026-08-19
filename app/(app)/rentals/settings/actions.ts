"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const WRITE_ROLES = ["admin", "managing_officer", "hotel_rental_monitoring"] as const;

async function requireWrite() {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...WRITE_ROLES])) throw new Error("Access denied.");
  return user;
}

// ── AirBnB Rate Plans ─────────────────────────────────────────────────────────

export async function saveAirbnbRatePlan(
  id: string | null,
  name: string,
  rateType: string,
  rate: number,
  minNights: number,
  description: string,
  sortOrder: number,
): Promise<ActionResult> {
  await requireWrite();
  if (!name.trim()) return { ok: false, error: "Name is required." };
  if (!Number.isFinite(rate) || rate < 0) return { ok: false, error: "Enter a valid rate." };
  const admin = createAdminClient();
  const payload = { name: name.trim(), rate_type: rateType, rate, min_nights: minNights,
    description: description.trim() || null, sort_order: sortOrder };
  const { error } = id
    ? await admin.from("airbnb_rate_plans").update(payload).eq("id", id)
    : await admin.from("airbnb_rate_plans").insert(payload);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

export async function toggleAirbnbRatePlan(id: string, isActive: boolean): Promise<ActionResult> {
  await requireWrite();
  const admin = createAdminClient();
  const { error } = await admin.from("airbnb_rate_plans").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

export async function deleteAirbnbRatePlan(id: string): Promise<ActionResult> {
  await requireWrite();
  const admin = createAdminClient();
  const { error } = await admin.from("airbnb_rate_plans").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

// ── AirBnB Extras ─────────────────────────────────────────────────────────────

export async function saveAirbnbExtra(
  id: string | null,
  name: string,
  category: string,
  unitPrice: number,
  sortOrder: number,
): Promise<ActionResult> {
  await requireWrite();
  if (!name.trim()) return { ok: false, error: "Name is required." };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: "Enter a valid price." };
  const admin = createAdminClient();
  const payload = { name: name.trim(), category, unit_price: unitPrice, sort_order: sortOrder };
  const { error } = id
    ? await admin.from("airbnb_extras").update(payload).eq("id", id)
    : await admin.from("airbnb_extras").insert(payload);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

export async function toggleAirbnbExtra(id: string, isActive: boolean): Promise<ActionResult> {
  await requireWrite();
  const admin = createAdminClient();
  const { error } = await admin.from("airbnb_extras").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

export async function deleteAirbnbExtra(id: string): Promise<ActionResult> {
  await requireWrite();
  const admin = createAdminClient();
  const { error } = await admin.from("airbnb_extras").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

// ── Tax settings ──────────────────────────────────────────────────────────────

export async function saveAirbnbTax(taxMode: string, taxRate: number): Promise<ActionResult> {
  await requireWrite();
  const admin = createAdminClient();
  const { error } = await admin.from("airbnb_tax_settings")
    .upsert({ id: 1, tax_mode: taxMode, tax_rate: taxRate });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

export async function saveRentalTax(taxMode: string, taxRate: number): Promise<ActionResult> {
  await requireWrite();
  const admin = createAdminClient();
  const { error } = await admin.from("rental_tax_settings")
    .upsert({ id: 1, tax_mode: taxMode, tax_rate: taxRate });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

// ── Utility rates ─────────────────────────────────────────────────────────────

export async function saveUtilityRate(
  utility: string,
  ratePerUnit: number,
  serviceCharge: number,
  effectiveFrom: string,
  notes: string,
): Promise<ActionResult> {
  const user = await requireWrite();
  if (!["electric", "water"].includes(utility)) return { ok: false, error: "Invalid utility." };
  if (!Number.isFinite(ratePerUnit) || ratePerUnit < 0) return { ok: false, error: "Enter a valid rate." };
  if (!effectiveFrom) return { ok: false, error: "Effective date is required." };
  const admin = createAdminClient();
  const { error } = await admin.from("utility_rates").insert({
    utility, rate_per_unit: ratePerUnit, service_charge: serviceCharge,
    effective_from: effectiveFrom, notes: notes.trim() || null,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals/settings");
  return { ok: true };
}

// ── AirBnB order (staff) ──────────────────────────────────────────────────────

export async function placeStaffOrder(
  leaseId: string,
  items: { extraId: string; name: string; qty: number; unitPrice: number }[],
  notes: string,
): Promise<ActionResult> {
  const user = await requireWrite();
  if (!items.length) return { ok: false, error: "Add at least one item." };
  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const admin = createAdminClient();
  const { data: order, error: oErr } = await admin
    .from("airbnb_orders")
    .insert({ lease_id: leaseId, placed_by: user.userId, placed_by_guest: false,
      notes: notes.trim() || null, total })
    .select("id").single();
  if (oErr || !order) return { ok: false, error: oErr?.message ?? "Failed to create order." };
  await admin.from("airbnb_order_items").insert(
    items.map((i) => ({
      order_id: order.id, extra_id: i.extraId, name: i.name,
      qty: i.qty, unit_price: i.unitPrice, subtotal: i.qty * i.unitPrice,
    }))
  );
  revalidatePath("/rentals");
  return { ok: true };
}

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  await requireWrite();
  const admin = createAdminClient();
  const { error } = await admin.from("airbnb_orders").update({ status }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals");
  return { ok: true };
}

// ── AirBnB request (staff) ────────────────────────────────────────────────────

export async function createAirbnbRequest(
  leaseId: string,
  requestType: "cleaning" | "maintenance",
  notes: string,
): Promise<ActionResult> {
  const user = await requireWrite();
  const admin = createAdminClient();

  // Get unit_id for this lease (needed for housekeeping task / repair)
  const { data: lease } = await admin.from("leases").select("unit_id").eq("id", leaseId).maybeSingle();
  const unitId = (lease?.unit_id as string | null) ?? null;

  let housekeepingTaskId: string | null = null;
  let repairRequestId: string | null = null;

  if (requestType === "cleaning") {
    const { createCleaningTask } = await import("@/lib/housekeeping/create-task");
    housekeepingTaskId = await createCleaningTask({ unitId, actorUserId: user.userId, via: "airbnb_request" });
  } else {
    // Auto-create repair request
    const ticketRef = `ARB-${Date.now().toString(36).toUpperCase()}`;
    const { data: repair } = await admin.from("repair_requests").insert({
      ticket_ref: ticketRef, unit_id: unitId,
      requester_type: "guest", requester_ref: leaseId,
      issue_type: "Maintenance", description: notes.trim() || "AirBnB maintenance request",
      urgency: "normal", status: "submitted",
    }).select("id").single();
    repairRequestId = (repair?.id as string) ?? null;
  }

  const { error } = await admin.from("airbnb_requests").insert({
    lease_id: leaseId, request_type: requestType,
    notes: notes.trim() || null, placed_by: user.userId, placed_by_guest: false,
    housekeeping_task_id: housekeepingTaskId, repair_request_id: repairRequestId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals");
  return { ok: true };
}

export async function updateRequestStatus(requestId: string, status: string): Promise<ActionResult> {
  await requireWrite();
  const admin = createAdminClient();
  const update: Record<string, unknown> = { status };
  if (status === "cancelled") update.cancelled_at = new Date().toISOString();
  const { error } = await admin.from("airbnb_requests").update(update).eq("id", requestId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rentals");
  return { ok: true };
}
