"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveSession } from "@/lib/hotel/session";
import { computeExtension } from "@/lib/hotel/extension";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SUPERVISOR_ROLES = [
  "hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting",
] as const;
const CASHIER_ROLES = ["hotel_cashier", ...SUPERVISOR_ROLES] as const;

export async function openShift(
  beginningArNo: string,
  notes: string,
  shiftType: 'day' | 'night',
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Access denied." };

  const trimmed = beginningArNo.trim();
  if (!trimmed) return { ok: false, error: "Beginning AR number is required." };
  if (shiftType !== 'day' && shiftType !== 'night')
    return { ok: false, error: "Invalid shift type." };

  const existing = await getActiveSession();
  if (existing)
    return { ok: false, error: `${existing.cashierName} is already on duty. Their shift must be closed first.` };

  const admin = createAdminClient();
  const { error } = await admin.from("hotel_cashier_sessions").insert({
    cashier_user_id: user.userId,
    beginning_ar_no: trimmed,
    shift_type: shiftType,
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
): Promise<ActionResult & { reportId?: string }> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Access denied." };

  const trimmed = endingArNo.trim();
  if (!trimmed) return { ok: false, error: "Ending AR number is required." };

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("hotel_cashier_sessions")
    .select("id, cashier_user_id, opened_at, beginning_ar_no, closed_at, shift_type")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: "Session not found." };
  if (session.closed_at) return { ok: false, error: "Session is already closed." };

  const isSupervisor = userHasAnyRole(user, [...SUPERVISOR_ROLES]);
  const isOwnSession = session.cashier_user_id === user.userId;
  if (!isOwnSession && !isSupervisor)
    return { ok: false, error: "Only the cashier on duty or a supervisor can close this shift." };

  const closedAt = new Date().toISOString();

  const { error } = await admin
    .from("hotel_cashier_sessions")
    .update({
      ending_ar_no: trimmed,
      closed_at: closedAt,
      closed_by: user.userId,
      notes: notes.trim() || null,
    })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };

  // ── Auto-generate shift report ──────────────────────────────────────────────

  // Get cashier name
  const { data: cashierProfile } = await admin
    .from("profiles")
    .select("display_label")
    .eq("id", session.cashier_user_id as string)
    .maybeSingle();
  const cashierName = (cashierProfile?.display_label as string | null) ?? "Unknown";

  // Payments during shift window, joined with stays for guest name
  const { data: pays } = await admin
    .from("stay_payments")
    .select("ar_no, amount, method, created_at, stays(guest_label)")
    .gte("created_at", session.opened_at as string)
    .lte("created_at", closedAt)
    .order("created_at", { ascending: true });

  const paymentsJson = (pays ?? []).map((p) => {
    const stayRaw = p.stays;
    const stay = (stayRaw && !Array.isArray(stayRaw)) ? stayRaw as { guest_label: string } : null;
    return {
      arNo: (p.ar_no as string | null) ?? null,
      guest: stay?.guest_label ?? "—",
      amount: Number(p.amount),
      method: p.method as string,
      paidAt: p.created_at as string,
    };
  });

  // Cancelled ARs for this session
  const { data: cancels } = await admin
    .from("hotel_ar_cancellations")
    .select("ar_no, reason, cancelled_at")
    .eq("session_id", sessionId)
    .order("cancelled_at", { ascending: true });

  const cancelledArsJson = (cancels ?? []).map((c) => ({
    arNo: c.ar_no as string,
    reason: c.reason as string,
    loggedAt: c.cancelled_at as string,
  }));

  const totalCollected = paymentsJson.reduce((s, p) => s + p.amount, 0);
  const cancelledCount = cancelledArsJson.length;
  const beginningNo = parseInt(String(session.beginning_ar_no).replace(/\D/g, ""), 10) || 0;
  const endingNo = parseInt(trimmed.replace(/\D/g, ""), 10) || 0;
  const arCount = Math.max(0, endingNo - beginningNo + 1 - cancelledCount);

  // Compute expected collection: stays checked out during this shift window
  const { data: staysOut } = await admin
    .from("stays")
    .select("id, guest_label, check_in_at, check_out_at, planned_hours, base_hours, base_rate, extra_hour_rate, discount_amount, units(unit_number)")
    .eq("status", "checked_out")
    .gte("check_out_at", session.opened_at as string)
    .lte("check_out_at", closedAt)
    .order("check_out_at", { ascending: true });

  const extensionDetailsJson = (staysOut ?? []).map((s) => {
    const unitRaw = s.units;
    const unitNumber = (unitRaw && !Array.isArray(unitRaw)) ? (unitRaw as { unit_number: string }).unit_number : "—";
    return computeExtension({
      id: s.id as string,
      guest_label: s.guest_label as string,
      check_in_at: s.check_in_at as string,
      check_out_at: s.check_out_at as string | null,
      planned_hours: Number(s.planned_hours),
      base_hours: Number(s.base_hours),
      base_rate: Number(s.base_rate),
      extra_hour_rate: Number(s.extra_hour_rate),
      discount_amount: Number(s.discount_amount),
    }, unitNumber);
  }).filter(Boolean);

  const expectedCollection = Math.round(
    extensionDetailsJson.reduce((s, d) => s + (d?.totalExpected ?? 0), 0) * 100,
  ) / 100;
  const discrepancyAmount = Math.round((expectedCollection - totalCollected) * 100) / 100;

  const { data: report } = await admin
    .from("hotel_shift_reports")
    .insert({
      session_id: sessionId,
      cashier_user_id: session.cashier_user_id,
      cashier_name: cashierName,
      shift_type: (session.shift_type as string | null) ?? null,
      opened_at: session.opened_at,
      closed_at: closedAt,
      beginning_ar_no: session.beginning_ar_no,
      ending_ar_no: trimmed,
      payments_json: paymentsJson,
      cancelled_ars_json: cancelledArsJson,
      total_collected: totalCollected,
      ar_count: arCount,
      cancelled_count: cancelledCount,
      closed_by_supervisor: !isOwnSession,
      closing_user_id: isOwnSession ? null : user.userId,
      expected_collection: expectedCollection || null,
      discrepancy_amount: discrepancyAmount !== 0 ? discrepancyAmount : null,
      extension_details_json: extensionDetailsJson,
    })
    .select("id")
    .single();

  revalidatePath("/hotel");
  revalidatePath("/hotel/shifts");
  return { ok: true, reportId: report?.id };
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

export async function cancelShift(
  sessionId: string,
  reason: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...SUPERVISOR_ROLES]))
    return { ok: false, error: "Only supervisors can void/cancel a shift." };

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { ok: false, error: "A reason is required to cancel a shift." };

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("hotel_cashier_sessions")
    .select("id, cashier_user_id, opened_at, beginning_ar_no, closed_at, shift_type")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: "Session not found." };
  if (session.closed_at) return { ok: false, error: "Session is already closed." };

  const cancelledAt = new Date().toISOString();

  // Close the session — keep beginning_ar_no as ending since no new ARs are formally issued
  await admin
    .from("hotel_cashier_sessions")
    .update({
      ending_ar_no: session.beginning_ar_no as string,
      closed_at: cancelledAt,
      closed_by: user.userId,
      notes: `VOIDED by supervisor — ${trimmedReason}`,
    })
    .eq("id", sessionId);

  // Get cashier name
  const { data: cashierProfile } = await admin
    .from("profiles")
    .select("display_label")
    .eq("id", session.cashier_user_id as string)
    .maybeSingle();
  const cashierName = (cashierProfile?.display_label as string | null) ?? "Unknown";

  // Collect all payments made during this shift window so accounting still sees them
  const { data: pays } = await admin
    .from("stay_payments")
    .select("ar_no, amount, method, created_at, stays(guest_label)")
    .gte("created_at", session.opened_at as string)
    .lte("created_at", cancelledAt)
    .order("created_at", { ascending: true });

  const paymentsJson = (pays ?? []).map((p) => {
    const stayRaw = p.stays;
    const stay = (stayRaw && !Array.isArray(stayRaw)) ? stayRaw as { guest_label: string } : null;
    return {
      arNo: (p.ar_no as string | null) ?? null,
      guest: stay?.guest_label ?? "—",
      amount: Number(p.amount),
      method: p.method as string,
      paidAt: p.created_at as string,
    };
  });

  const { data: cancels } = await admin
    .from("hotel_ar_cancellations")
    .select("ar_no, reason, cancelled_at")
    .eq("session_id", sessionId)
    .order("cancelled_at", { ascending: true });

  const cancelledArsJson = (cancels ?? []).map((c) => ({
    arNo: c.ar_no as string,
    reason: c.reason as string,
    loggedAt: c.cancelled_at as string,
  }));

  const totalCollected = paymentsJson.reduce((s, p) => s + p.amount, 0);

  // Insert voided report — includes real payments for accounting; active stays are untouched
  await admin.from("hotel_shift_reports").insert({
    session_id: sessionId,
    cashier_user_id: session.cashier_user_id,
    cashier_name: cashierName,
    shift_type: (session.shift_type as string | null) ?? null,
    opened_at: session.opened_at,
    closed_at: cancelledAt,
    beginning_ar_no: session.beginning_ar_no,
    ending_ar_no: session.beginning_ar_no,
    payments_json: paymentsJson,
    cancelled_ars_json: cancelledArsJson,
    total_collected: totalCollected,
    ar_count: paymentsJson.length,
    cancelled_count: cancelledArsJson.length,
    closed_by_supervisor: true,
    closing_user_id: user.userId,
    // Auto-acknowledge voided shifts
    status: "acknowledged",
    acknowledged_by: user.userId,
    acknowledged_at: cancelledAt,
    acknowledged_notes: `Shift voided: ${trimmedReason}. Collections preserved (${paymentsJson.length} payment(s), ₱${totalCollected.toLocaleString()}). Active check-ins continue.`,
  });

  revalidatePath("/hotel");
  revalidatePath("/hotel/shifts");
  return { ok: true };
}

/** Cashier submits a reason explaining a discrepancy between expected and actual collection. */
export async function submitDiscrepancyReason(
  reportId: string,
  reason: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...CASHIER_ROLES]))
    return { ok: false, error: "Access denied." };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "A reason is required." };

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("hotel_shift_reports")
    .select("id, discrepancy_amount, discrepancy_reason")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { ok: false, error: "Report not found." };
  if (!(report.discrepancy_amount)) return { ok: false, error: "No discrepancy recorded on this report." };

  const { error } = await admin
    .from("hotel_shift_reports")
    .update({ discrepancy_reason: trimmed })
    .eq("id", reportId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/hotel/shifts/${report.id}/report`);
  return { ok: true };
}

/** Monitoring corrects a payment entry in a shift report. Logged for audit. */
export async function correctShiftPayment(
  reportId: string,
  paymentIndex: number | null,
  field: "ar_no" | "amount" | "method" | "guest",
  oldValue: string,
  newValue: string,
  reason: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...SUPERVISOR_ROLES]))
    return { ok: false, error: "Only Hotel & Rental Monitoring or above can correct shift reports." };

  const trimmedReason = reason.trim();
  const trimmedNew    = newValue.trim();
  if (!trimmedReason) return { ok: false, error: "A reason is required for every correction." };
  if (!trimmedNew)    return { ok: false, error: "New value cannot be empty." };

  const admin = createAdminClient();

  // Load the report
  const { data: report } = await admin
    .from("hotel_shift_reports")
    .select("id, payments_json, total_collected")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { ok: false, error: "Report not found." };

  // Apply the correction to the payments_json array
  type Payment = { arNo: string | null; guest: string; amount: number; method: string; paidAt: string };
  const payments: Payment[] = Array.isArray(report.payments_json) ? (report.payments_json as Payment[]) : [];

  if (paymentIndex !== null) {
    if (paymentIndex < 0 || paymentIndex >= payments.length)
      return { ok: false, error: "Invalid payment index." };

    const p = { ...payments[paymentIndex] };
    if (field === "ar_no")    p.arNo   = trimmedNew;
    if (field === "amount")   p.amount = parseFloat(trimmedNew);
    if (field === "method")   p.method = trimmedNew;
    if (field === "guest")    p.guest  = trimmedNew;
    if (field === "amount" && !Number.isFinite(p.amount))
      return { ok: false, error: "Amount must be a valid number." };
    payments[paymentIndex] = p;
  }

  const newTotal = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;

  const { error: upErr } = await admin
    .from("hotel_shift_reports")
    .update({
      payments_json: payments,
      total_collected: newTotal,
    })
    .eq("id", reportId);

  if (upErr) return { ok: false, error: upErr.message };

  // Get corrector's name
  const { data: prof } = await admin
    .from("profiles")
    .select("display_label")
    .eq("id", user.userId)
    .maybeSingle();
  const correctorName = (prof?.display_label as string | null) ?? user.userId;

  // Log the correction
  await admin.from("hotel_shift_corrections").insert({
    report_id: reportId,
    corrected_by: user.userId,
    corrector_name: correctorName,
    payment_index: paymentIndex,
    field,
    old_value: oldValue,
    new_value: trimmedNew,
    reason: trimmedReason,
  });

  revalidatePath(`/hotel/shifts/${reportId}/report`);
  revalidatePath("/hotel/shifts");
  return { ok: true };
}

export async function acknowledgeShiftReport(
  reportId: string,
  acknowledgedNotes: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...SUPERVISOR_ROLES]))
    return { ok: false, error: "Access denied. Only hotel_rental_monitoring, accounting, admin, managing_officer, or consultant can acknowledge reports." };

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("hotel_shift_reports")
    .select("id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { ok: false, error: "Report not found." };
  if (report.status === "acknowledged") return { ok: false, error: "Report already acknowledged." };

  const { error } = await admin
    .from("hotel_shift_reports")
    .update({
      status: "acknowledged",
      acknowledged_by: user.userId,
      acknowledged_at: new Date().toISOString(),
      acknowledged_notes: acknowledgedNotes.trim() || null,
    })
    .eq("id", reportId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/hotel/shifts");
  return { ok: true };
}
