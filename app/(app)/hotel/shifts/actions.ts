"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveSession } from "@/lib/hotel/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SUPERVISOR_ROLES = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant"] as const;
const CASHIER_ROLES    = ["hotel_cashier", ...SUPERVISOR_ROLES] as const;

export async function openShift(beginningArNo: string, notes: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Access denied." };

  const trimmed = beginningArNo.trim();
  if (!trimmed) return { ok: false, error: "Beginning AR number is required." };

  const existing = await getActiveSession();
  if (existing)
    return { ok: false, error: `${existing.cashierName} is already on duty. Their shift must be closed first.` };

  const admin = createAdminClient();
  const { error } = await admin.from("hotel_cashier_sessions").insert({
    cashier_user_id: user.userId,
    beginning_ar_no: trimmed,
    notes: notes.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hotel");
  revalidatePath("/hotel/shifts");
  return { ok: true };
}

export async function closeShift(
  sessionId: string,
  endingArNo: string,
  notes: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Access denied." };

  const trimmed = endingArNo.trim();
  if (!trimmed) return { ok: false, error: "Ending AR number is required." };

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("hotel_cashier_sessions")
    .select("id, cashier_user_id, closed_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: "Session not found." };
  if (session.closed_at) return { ok: false, error: "Session is already closed." };

  // Only the active cashier themselves OR a supervisor can close
  const isSupervisor = userHasAnyRole(user, [...SUPERVISOR_ROLES]);
  const isOwnSession = session.cashier_user_id === user.userId;
  if (!isOwnSession && !isSupervisor)
    return { ok: false, error: "Only the cashier on duty or a supervisor can close this shift." };

  const { error } = await admin
    .from("hotel_cashier_sessions")
    .update({
      ending_ar_no: trimmed,
      closed_at: new Date().toISOString(),
      closed_by: user.userId,
      notes: notes.trim() || null,
    })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/hotel");
  revalidatePath("/hotel/shifts");
  return { ok: true };
}

export async function logCancelledAr(
  sessionId: string,
  arNo: string,
  reason: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Access denied." };

  const trimmedAr = arNo.trim();
  const trimmedReason = reason.trim();
  if (!trimmedAr)     return { ok: false, error: "AR number is required." };
  if (!trimmedReason) return { ok: false, error: "Cancellation reason is required." };

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("hotel_cashier_sessions")
    .select("id, closed_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: "Session not found." };
  if (session.closed_at) return { ok: false, error: "Cannot add cancellations to a closed session." };

  const { error } = await admin.from("hotel_ar_cancellations").insert({
    session_id: sessionId,
    ar_no: trimmedAr,
    reason: trimmedReason,
    cancelled_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hotel/shifts");
  return { ok: true };
}
