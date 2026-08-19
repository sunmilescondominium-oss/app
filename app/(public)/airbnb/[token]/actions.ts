"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlert } from "@/lib/alerts/sendAlert";

export type GuestActionState = { ok: true; message: string } | { ok: false; error: string } | undefined;

async function leaseByToken(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("leases").select("id, tenant_label, status, business_line, units(unit_number)").eq("portal_token", token).maybeSingle();
  return data;
}

export async function requestAirbnbExtension(token: string, request: string): Promise<GuestActionState> {
  const note = request.trim();
  if (!note) return { ok: false, error: "Tell us how much longer you'd like to stay." };
  const l = await leaseByToken(token);
  if (!l || l.status !== "active" || l.business_line !== "airbnb") return { ok: false, error: "This booking is no longer active." };

  const admin = createAdminClient();
  await admin.from("leases").update({ extension_requested: note, guest_request_at: new Date().toISOString() }).eq("id", l.id);
  const unit = (l.units as { unit_number?: string } | null)?.unit_number ?? "?";
  await sendAlert({
    subject: `⏱️ Airbnb extension requested — ${unit}`,
    body: `${l.tenant_label} (${unit}) requested to extend: "${note}". Confirm the new checkout in Rentals.`,
  }).catch(() => {});
  revalidatePath(`/airbnb/${token}`);
  return { ok: true, message: "Extension requested. The host will confirm the new checkout and rate shortly." };
}

export async function requestAirbnbCheckout(token: string): Promise<GuestActionState> {
  const l = await leaseByToken(token);
  if (!l || l.status !== "active" || l.business_line !== "airbnb") return { ok: false, error: "This booking is no longer active." };

  const admin = createAdminClient();
  await admin.from("leases").update({ checkout_requested: true, guest_request_at: new Date().toISOString() }).eq("id", l.id);
  const unit = (l.units as { unit_number?: string } | null)?.unit_number ?? "?";
  await sendAlert({
    subject: `🔔 Airbnb check-out — ${unit}`,
    body: `${l.tenant_label} (${unit}) requested check-out. Settle any extra charges, then check the unit and turn it over to housekeeping.`,
  }).catch(() => {});
  revalidatePath(`/airbnb/${token}`);
  return { ok: true, message: "Check-out requested. The host will settle any extra charges and prepare the unit." };
}

// ── Guest orders ──────────────────────────────────────────────────────────────

export async function placeGuestOrder(
  token: string,
  items: { extraId: string; name: string; qty: number; unitPrice: number }[],
  notes: string,
): Promise<GuestActionState> {
  if (!items.length) return { ok: false, error: "Select at least one item." };
  const l = await leaseByToken(token);
  if (!l || l.status !== "active" || l.business_line !== "airbnb") return { ok: false, error: "This booking is no longer active." };

  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const admin = createAdminClient();
  const { data: order, error: oErr } = await admin
    .from("airbnb_orders")
    .insert({ lease_id: l.id, placed_by_guest: true, notes: notes.trim() || null, total })
    .select("id").single();
  if (oErr || !order) return { ok: false, error: oErr?.message ?? "Could not place order." };

  await admin.from("airbnb_order_items").insert(
    items.map((i) => ({
      order_id: order.id, extra_id: i.extraId, name: i.name,
      qty: i.qty, unit_price: i.unitPrice, subtotal: i.qty * i.unitPrice,
    }))
  );
  const unit = (l.units as { unit_number?: string } | null)?.unit_number ?? "?";
  await sendAlert({
    subject: `🛎 AirBnB order — ${unit}`,
    body: `${l.tenant_label} (${unit}) placed an order: ${items.map((i) => `${i.qty}× ${i.name}`).join(", ")}. Total: ₱${total.toLocaleString("en-PH")}.`,
  }).catch(() => {});
  revalidatePath(`/airbnb/${token}`);
  return { ok: true, message: "Order placed. Staff will deliver your items shortly." };
}

// ── Guest requests (cleaning / maintenance) ───────────────────────────────────

export async function requestGuestCleaning(token: string, notes: string): Promise<GuestActionState> {
  const l = await leaseByToken(token);
  if (!l || l.status !== "active" || l.business_line !== "airbnb") return { ok: false, error: "This booking is no longer active." };

  const admin = createAdminClient();
  const { data: lease } = await admin.from("leases").select("unit_id").eq("id", l.id).maybeSingle();
  const unitId = (lease?.unit_id as string | null) ?? null;

  const { createCleaningTask } = await import("@/lib/housekeeping/create-task");
  const taskId = await createCleaningTask({ unitId, actorUserId: null, via: "airbnb_guest_request" });

  const { error } = await admin.from("airbnb_requests").insert({
    lease_id: l.id, request_type: "cleaning", notes: notes.trim() || null,
    placed_by_guest: true, housekeeping_task_id: taskId,
  });
  if (error) return { ok: false, error: error.message };

  const unit = (l.units as { unit_number?: string } | null)?.unit_number ?? "?";
  await sendAlert({
    subject: `🧹 Cleaning request — ${unit}`,
    body: `${l.tenant_label} (${unit}) requested room cleaning.${notes ? ` Note: ${notes}` : ""}`,
  }).catch(() => {});
  revalidatePath(`/airbnb/${token}`);
  return { ok: true, message: "Cleaning request submitted. Housekeeping will schedule your room." };
}

export async function requestGuestMaintenance(token: string, notes: string): Promise<GuestActionState> {
  const trimmedNotes = notes.trim();
  if (!trimmedNotes) return { ok: false, error: "Please describe the issue." };
  const l = await leaseByToken(token);
  if (!l || l.status !== "active" || l.business_line !== "airbnb") return { ok: false, error: "This booking is no longer active." };

  const admin = createAdminClient();
  const { data: lease } = await admin.from("leases").select("unit_id").eq("id", l.id).maybeSingle();
  const unitId = (lease?.unit_id as string | null) ?? null;

  const ticketRef = `ARB-${Date.now().toString(36).toUpperCase()}`;
  const { data: repair } = await admin.from("repair_requests").insert({
    ticket_ref: ticketRef, unit_id: unitId, requester_type: "guest",
    requester_ref: `airbnb:${l.id}`, issue_type: "Maintenance",
    description: trimmedNotes, urgency: "normal", status: "submitted",
  }).select("id").single();

  await admin.from("airbnb_requests").insert({
    lease_id: l.id, request_type: "maintenance", notes: trimmedNotes,
    placed_by_guest: true, repair_request_id: repair?.id ?? null,
  });

  const unit = (l.units as { unit_number?: string } | null)?.unit_number ?? "?";
  await sendAlert({
    subject: `🔧 Maintenance request — ${unit} (${ticketRef})`,
    body: `${l.tenant_label} (${unit}): ${trimmedNotes}`,
  }).catch(() => {});
  revalidatePath(`/airbnb/${token}`);
  return { ok: true, message: "Maintenance request logged. Our team will attend to it shortly." };
}

export async function cancelGuestCleaning(token: string, requestId: string): Promise<GuestActionState> {
  const l = await leaseByToken(token);
  if (!l || l.business_line !== "airbnb") return { ok: false, error: "Booking not found." };

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("airbnb_requests")
    .select("id, status, lease_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.lease_id !== l.id) return { ok: false, error: "Request not found." };
  if (req.status !== "pending") return { ok: false, error: "Only pending requests can be cancelled." };

  await admin.from("airbnb_requests").update({
    status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by_guest: true,
  }).eq("id", requestId);
  revalidatePath(`/airbnb/${token}`);
  return { ok: true, message: "Cleaning request cancelled." };
}
