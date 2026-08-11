"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { hashGiftCardPin, generateCardCode } from "@/lib/gift-cards/pin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const CONFIG_ROLES = ["admin", "consultant"] as const;
const CASHIER_ROLES = ["admin", "consultant", "hotel_cashier", "hotel_rental_monitoring"] as const;

// ---------------------------------------------------------------------------
// Sell / create a new gift card
// ---------------------------------------------------------------------------
export async function createGiftCard(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Only hotel cashier or admin can create gift cards." };

  const admin = createAdminClient();

  const owner_label = String(formData.get("owner_label") ?? "").trim();
  const owner_contact = String(formData.get("owner_contact") ?? "").trim() || null;
  const pin = String(formData.get("pin") ?? "").trim();
  const total_hours = Number(String(formData.get("total_hours") ?? ""));
  const purchase_price = Number(String(formData.get("purchase_price") ?? "0")) || 0;
  const max_hours_per_stay = parseInt(String(formData.get("max_hours_per_stay") ?? "6"), 10) || 6;
  const max_extension_hours = parseInt(String(formData.get("max_extension_hours") ?? "2"), 10) || 2;
  const buffer_minutes = parseInt(String(formData.get("buffer_minutes") ?? "30"), 10) || 30;
  const expires_days = parseInt(String(formData.get("expires_days") ?? "365"), 10) || 365;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!owner_label) return { ok: false, error: "Owner name is required." };
  if (pin.length < 4 || !/^\d{4,8}$/.test(pin)) return { ok: false, error: "PIN must be 4–8 digits." };
  if (!Number.isFinite(total_hours) || total_hours <= 0) return { ok: false, error: "Enter valid total hours." };

  // Auto-generate card code: GC-YYYY-NNN
  const year = new Date().getFullYear();
  const { count } = await admin.from("gift_cards").select("*", { count: "exact", head: true });
  const seq = (count ?? 0) + 1;
  const card_code = generateCardCode(year, seq);

  const pin_hash = hashGiftCardPin(card_code, pin);
  const expires_at = new Date(Date.now() + expires_days * 86_400_000).toISOString();
  const sold_by_role = user.roleKeys.find((r) => [...CASHIER_ROLES].includes(r as typeof CASHIER_ROLES[number])) ?? user.roleKeys[0] ?? null;

  const { data: card, error } = await admin.from("gift_cards").insert({
    card_code, pin_hash, owner_label, owner_contact, purchase_price,
    total_hours, balance_hours: total_hours,
    max_hours_per_stay, max_extension_hours, buffer_minutes,
    expires_at, sold_by_role, notes, created_by: user.userId,
  }).select("id, portal_token").single();
  if (error) return { ok: false, error: error.message };

  // Log the initial sale transaction
  await admin.from("gift_card_transactions").insert({
    gift_card_id: (card as Record<string, unknown>).id,
    type: "sale",
    hours: total_hours,
    balance_after: total_hours,
    amount_paid: purchase_price,
    notes: `Card sold to ${owner_label}`,
    created_by: user.userId,
  });

  await logAudit({
    actorUserId: user.userId, actorRoles: user.roleKeys,
    action: "create", entity: "gift_cards",
    entityId: (card as Record<string, unknown>).id as string,
    diff: { card_code, owner_label, total_hours, purchase_price },
  });
  revalidatePath("/hotel/gift-cards");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cashier activates a pre-scheduled reservation → starts the stay
// ---------------------------------------------------------------------------
export async function activateReservation(reservationId: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Only hotel cashier or admin can activate reservations." };

  const admin = createAdminClient();

  const { data: resv } = await admin
    .from("gift_card_reservations")
    .select("*, gift_cards(*)")
    .eq("id", reservationId)
    .maybeSingle();

  if (!resv) return { ok: false, error: "Reservation not found." };
  const row = resv as Record<string, unknown>;
  if (row.status !== "pending") return { ok: false, error: `Reservation is already ${row.status}.` };

  const card = row.gift_cards as Record<string, unknown>;
  if (!card.is_active) return { ok: false, error: "Gift card is no longer active." };
  const balance = Number(card.balance_hours);
  const planned = Number(row.planned_hours);
  if (balance < planned) return { ok: false, error: `Insufficient card balance (${balance.toFixed(1)}h remaining, ${planned}h requested).` };
  if (planned > Number(card.max_hours_per_stay)) return { ok: false, error: `Exceeds max ${card.max_hours_per_stay}h per stay for this card.` };

  const unitId = row.unit_id as string | null;
  if (unitId) {
    // Check the room isn't occupied or needs housekeeping
    const { data: existing } = await admin.from("stays").select("id").eq("unit_id", unitId).eq("status", "active").maybeSingle();
    if (existing) return { ok: false, error: "That room is already occupied." };
    const { data: hk } = await admin.from("housekeeping_tasks").select("id").eq("unit_id", unitId).in("status", ["pending", "in_progress"]).maybeSingle();
    if (hk) return { ok: false, error: "Room needs housekeeping before it can be occupied." };
  }

  const newBalance = Math.round((balance - planned) * 100) / 100;
  const checkInAt = new Date().toISOString();

  // Create stay (no advance payment — card is the payment)
  const { data: stay, error: stayErr } = await admin.from("stays").insert({
    unit_id: unitId,
    guest_label: card.owner_label,
    guest_contact: card.owner_contact,
    rate_plan_id: null,
    planned_hours: planned,
    base_hours: planned,
    base_rate: 0,
    extra_hour_rate: 0,
    discount_amount: 0,
    tax_mode: "none",
    tax_rate: 0,
    check_in_at: checkInAt,
    status: "active",
    gift_card_id: card.id,
    gift_card_reservation_id: reservationId,
  }).select("id").single();
  if (stayErr) return { ok: false, error: stayErr.message };

  const stayId = (stay as Record<string, unknown>).id as string;

  // Deduct hours from card
  await admin.from("gift_cards").update({ balance_hours: newBalance }).eq("id", card.id);
  await admin.from("gift_card_transactions").insert({
    gift_card_id: card.id, stay_id: stayId, reservation_id: reservationId,
    type: "checkin", hours: -planned, balance_after: newBalance,
    notes: `Check-in activated by ${user.roleKeys[0] ?? "staff"}`,
    created_by: user.userId,
  });
  await admin.from("gift_card_reservations").update({ status: "checked_in", stay_id: stayId, checked_in_at: checkInAt }).eq("id", reservationId);

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "stays", entityId: stayId, diff: { gift_card: card.card_code, planned_hours: planned } });
  revalidatePath("/hotel");
  revalidatePath("/hotel/gift-cards");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mark a reservation as no-show → deduct 1 hour penalty
// ---------------------------------------------------------------------------
export async function markNoShow(reservationId: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Only hotel cashier or admin can mark no-shows." };

  const admin = createAdminClient();
  const { data: resv } = await admin
    .from("gift_card_reservations")
    .select("*, gift_cards(id, card_code, balance_hours, is_active)")
    .eq("id", reservationId)
    .maybeSingle();

  if (!resv) return { ok: false, error: "Reservation not found." };
  const row = resv as Record<string, unknown>;
  if (row.status !== "pending") return { ok: false, error: `Reservation is already ${row.status}.` };

  const card = row.gift_cards as Record<string, unknown>;
  const balance = Number(card.balance_hours);
  const penalty = Math.min(1, balance);                // deduct 1h or remaining if < 1
  const newBalance = Math.round((balance - penalty) * 100) / 100;
  const now = new Date().toISOString();

  await admin.from("gift_cards").update({ balance_hours: newBalance }).eq("id", card.id);
  await admin.from("gift_card_transactions").insert({
    gift_card_id: card.id, reservation_id: reservationId,
    type: "no_show", hours: -penalty, balance_after: newBalance,
    notes: `No-show penalty — reservation ${reservationId.slice(0, 8).toUpperCase()}`,
    created_by: user.userId,
  });
  await admin.from("gift_card_reservations").update({ status: "no_show", no_show_at: now }).eq("id", reservationId);

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "gift_card_reservations", entityId: reservationId, diff: { no_show: true, penalty } });
  revalidatePath("/hotel/gift-cards");
  revalidatePath("/hotel");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Approve a patron load request → credit hours to card
// ---------------------------------------------------------------------------
export async function approveLoadRequest(requestId: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can approve load requests." };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("gift_card_load_requests")
    .select("*, gift_cards(id, balance_hours, total_hours, is_loadable)")
    .eq("id", requestId)
    .maybeSingle();

  if (!req) return { ok: false, error: "Load request not found." };
  const row = req as Record<string, unknown>;
  if (row.status !== "pending") return { ok: false, error: `Request is already ${row.status}.` };

  const card = row.gift_cards as Record<string, unknown>;
  if (!card.is_loadable) return { ok: false, error: "This card is not loadable." };

  const hrs = Number(row.hours_requested);
  const newBalance = Math.round((Number(card.balance_hours) + hrs) * 100) / 100;
  const newTotal = Math.round((Number(card.total_hours) + hrs) * 100) / 100;
  const now = new Date().toISOString();

  await admin.from("gift_cards").update({ balance_hours: newBalance, total_hours: newTotal }).eq("id", card.id);
  await admin.from("gift_card_transactions").insert({
    gift_card_id: card.id, load_request_id: requestId,
    type: "load", hours: hrs, balance_after: newBalance,
    amount_paid: Number(row.amount_paid), payment_method: row.payment_method as string,
    notes: `Load approved — ref: ${row.reference_no ?? "—"}`,
    created_by: user.userId,
  });
  await admin.from("gift_card_load_requests").update({ status: "approved", reviewed_by: user.userId, reviewed_at: now }).eq("id", requestId);

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "gift_card_load_requests", entityId: requestId, diff: { approved: true, hours: hrs } });
  revalidatePath("/hotel/gift-cards");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reject a load request
// ---------------------------------------------------------------------------
export async function rejectLoadRequest(
  requestId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can reject load requests." };

  const review_note = String(formData.get("review_note") ?? "").trim() || null;
  const admin = createAdminClient();
  const { error } = await admin.from("gift_card_load_requests").update({
    status: "rejected", reviewed_by: user.userId,
    reviewed_at: new Date().toISOString(), review_note,
  }).eq("id", requestId).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hotel/gift-cards");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Deactivate a gift card
// ---------------------------------------------------------------------------
export async function deactivateGiftCard(id: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CONFIG_ROLES]))
    return { ok: false, error: "Only admin or consultant can deactivate gift cards." };

  const admin = createAdminClient();
  const { error } = await admin.from("gift_cards").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "gift_cards", entityId: id, diff: { deactivated: true } });
  revalidatePath("/hotel/gift-cards");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cancel a pending reservation (staff)
// ---------------------------------------------------------------------------
export async function cancelReservation(reservationId: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Only hotel cashier or admin can cancel reservations." };

  const admin = createAdminClient();
  const { error } = await admin.from("gift_card_reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", reservationId).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hotel/gift-cards");
  revalidatePath("/hotel");
  return { ok: true };
}
