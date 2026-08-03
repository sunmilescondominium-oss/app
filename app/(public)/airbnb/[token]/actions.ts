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
