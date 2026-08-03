"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlert } from "@/lib/alerts/sendAlert";

export type GuestActionState = { ok: true; message: string } | { ok: false; error: string } | undefined;

async function stayByToken(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("stays").select("id, guest_label, status, units(unit_number)").eq("portal_token", token).maybeSingle();
  return data;
}

/** Guest requests more time — flags the stay + alerts the cashier. */
export async function requestExtension(token: string, hours: number): Promise<GuestActionState> {
  if (!Number.isFinite(hours) || hours < 1 || hours > 24) return { ok: false, error: "Choose 1–24 hours." };
  const s = await stayByToken(token);
  if (!s || s.status !== "active") return { ok: false, error: "This stay is no longer active." };

  const admin = createAdminClient();
  await admin.from("stays").update({ extension_requested_hours: hours, guest_request_at: new Date().toISOString() }).eq("id", s.id);
  const room = (s.units as { unit_number?: string } | null)?.unit_number ?? "?";
  await sendAlert({
    subject: `⏱️ Extension requested — Room ${room}`,
    body: `${s.guest_label} (Room ${room}) requested +${hours}h. Please confirm the extension in Hotel Ops.`,
  }).catch(() => {});
  revalidatePath(`/guest/${token}`);
  return { ok: true, message: `Requested +${hours}h. The front desk will confirm shortly.` };
}

/** Guest asks to check out — flags the stay + alerts the cashier for final bill + gate pass. */
export async function requestCheckout(token: string): Promise<GuestActionState> {
  const s = await stayByToken(token);
  if (!s || s.status !== "active") return { ok: false, error: "This stay is no longer active." };

  const admin = createAdminClient();
  await admin.from("stays").update({ checkout_requested: true, guest_request_at: new Date().toISOString() }).eq("id", s.id);
  const room = (s.units as { unit_number?: string } | null)?.unit_number ?? "?";
  await sendAlert({
    subject: `🔔 Check-out requested — Room ${room}`,
    body: `${s.guest_label} (Room ${room}) requested check-out. Prepare the final bill, check the unit, and issue the gate pass.`,
  }).catch(() => {});
  revalidatePath(`/guest/${token}`);
  return { ok: true, message: "Check-out requested. The front desk will prepare your final bill and gate pass." };
}
