"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type PortalResult = { ok: true } | { ok: false; error: string };

export async function createReservation(
  token: string,
  _prev: PortalResult | undefined,
  formData: FormData,
): Promise<PortalResult> {
  const admin = createAdminClient();
  const { data: card } = await admin
    .from("gift_cards")
    .select("id, balance_hours, max_hours_per_stay, buffer_minutes, is_active, expires_at")
    .eq("portal_token", token)
    .maybeSingle();
  if (!card) return { ok: false, error: "Card not found." };
  const c = card as Record<string, unknown>;
  if (!c.is_active) return { ok: false, error: "This card is no longer active." };
  if (c.expires_at && new Date(c.expires_at as string) < new Date()) return { ok: false, error: "This card has expired." };

  const scheduled_at = String(formData.get("scheduled_at") ?? "").trim();
  const planned_hours = parseInt(String(formData.get("planned_hours") ?? "3"), 10) || 3;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!scheduled_at) return { ok: false, error: "Please choose a date and time." };
  const dt = new Date(scheduled_at);
  if (isNaN(dt.getTime())) return { ok: false, error: "Invalid date/time." };
  if (dt < new Date()) return { ok: false, error: "Scheduled time must be in the future." };
  if (planned_hours < 1) return { ok: false, error: "Minimum 1 hour." };
  if (planned_hours > Number(c.max_hours_per_stay)) return { ok: false, error: `Max ${c.max_hours_per_stay}h per stay for this card.` };
  if (Number(c.balance_hours) < planned_hours) return { ok: false, error: `Insufficient balance (${c.balance_hours}h remaining).` };

  const { error } = await admin.from("gift_card_reservations").insert({
    gift_card_id: c.id,
    planned_hours,
    scheduled_at: dt.toISOString(),
    buffer_minutes: Number(c.buffer_minutes),
    notes,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/gift-card/${token}`);
  return { ok: true };
}

export async function submitLoadRequest(
  token: string,
  _prev: PortalResult | undefined,
  formData: FormData,
): Promise<PortalResult> {
  const admin = createAdminClient();
  const { data: card } = await admin
    .from("gift_cards")
    .select("id, is_active, is_loadable")
    .eq("portal_token", token)
    .maybeSingle();
  if (!card) return { ok: false, error: "Card not found." };
  const c = card as Record<string, unknown>;
  if (!c.is_active) return { ok: false, error: "Card is inactive." };
  if (!c.is_loadable) return { ok: false, error: "This card is not loadable." };

  const amount_paid = parseFloat(String(formData.get("amount_paid") ?? "0")) || 0;
  const payment_method = String(formData.get("payment_method") ?? "").trim();
  const reference_no = String(formData.get("reference_no") ?? "").trim() || null;
  const hours_requested = parseFloat(String(formData.get("hours_requested") ?? "0")) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (amount_paid <= 0) return { ok: false, error: "Enter a valid amount." };
  if (!payment_method) return { ok: false, error: "Select a payment method." };
  if (hours_requested <= 0) return { ok: false, error: "Enter hours to load." };

  const { error } = await admin.from("gift_card_load_requests").insert({
    gift_card_id: c.id,
    amount_paid,
    payment_method,
    reference_no,
    hours_requested,
    notes,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/gift-card/${token}`);
  return { ok: true };
}
