import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ShiftType = 'day' | 'night';

export interface CashierSession {
  id: string;
  cashierUserId: string;
  cashierName: string;
  openedAt: string;
  beginningArNo: string;
  endingArNo: string | null;
  closedAt: string | null;
  closedByName: string | null;
  notes: string | null;
  shiftType: ShiftType | null;
  collectionStartsAt: string | null;
  collectionEndsAt: string | null;
  bagDenominations: Record<string, number> | null;
  baggedAt: string | null;
  bagSkipped: boolean;
  bagSkippedReason: string | null;
}

/**
 * Computes the 20-min-before-shift-end collection window for the given shift type.
 * Day  shift: 05:40–17:40 Manila
 * Night shift: 17:40–05:40 Manila (next day)
 * Rolls back one day if the computed candidate is in the future.
 */
export function computeCollectionWindow(
  shiftType: ShiftType,
  now: Date = new Date(),
): { startsAt: string; endsAt: string } {
  const hour = shiftType === 'day' ? 5 : 17;

  function manilaDateStr(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
  }

  let candidate = new Date(
    `${manilaDateStr(now)}T${String(hour).padStart(2, '0')}:40:00+08:00`,
  );
  if (candidate > now) {
    candidate = new Date(
      `${manilaDateStr(new Date(now.getTime() - 86_400_000))}T${String(hour).padStart(2, '0')}:40:00+08:00`,
    );
  }

  const startsAt = candidate.toISOString();
  const endsAt = new Date(candidate.getTime() + 12 * 60 * 60 * 1000).toISOString();
  return { startsAt, endsAt };
}

export interface ArCancellation {
  id: string;
  arNo: string;
  reason: string;
  cancelledBy: string;
  cancelledAt: string;
}

export interface SessionSummary extends CashierSession {
  payments: { arNo: string | null; amount: number; method: string; issuedAt: string }[];
  cancellations: ArCancellation[];
}

/** Batch-fetch display_label for a set of user IDs from the profiles table. */
async function resolveNames(admin: SupabaseClient, userIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean) as string[])];
  if (!ids.length) return new Map();
  const { data } = await admin.from("profiles").select("id, display_label").in("id", ids);
  const map = new Map<string, string>();
  (data ?? []).forEach((p) => map.set(p.id as string, (p.display_label as string) ?? "Unknown"));
  return map;
}

/** Returns the currently open (unclosed) cashier session, or null if no one is on duty. */
export async function getActiveSession(): Promise<CashierSession | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_cashier_sessions")
    .select("*")
    .is("closed_at", null)
    .maybeSingle();
  if (!data) return null;
  const names = await resolveNames(admin, [data.cashier_user_id as string, data.closed_by as string | null]);
  return mapSessionRaw(data, names);
}

/** Returns ALL open sessions (closed_at IS NULL). Normally 0 or 1, but may be more if data is stuck. */
export async function getAllOpenSessions(): Promise<CashierSession[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_cashier_sessions")
    .select("*")
    .is("closed_at", null)
    .order("opened_at", { ascending: false });
  const rows = data ?? [];
  const userIds = rows.flatMap((r) => [r.cashier_user_id as string, r.closed_by as string | null]);
  const names = await resolveNames(admin, userIds);
  return rows.map((r) => mapSessionRaw(r, names));
}

/** Returns paginated session history (most recent first). */
export async function getSessionHistory(limit = 20): Promise<CashierSession[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_cashier_sessions")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const userIds = rows.flatMap((r) => [r.cashier_user_id as string, r.closed_by as string | null]);
  const names = await resolveNames(admin, userIds);
  return rows.map((r) => mapSessionRaw(r, names));
}

/** Full session detail: session + payments with AR nos + cancelled ARs. */
export async function getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const admin = createAdminClient();
  const [{ data: s }, { data: pays }, { data: cancels }] = await Promise.all([
    admin
      .from("hotel_cashier_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle(),
    admin
      .from("stay_payments")
      .select("ar_no, amount, method, created_at")
      .gte("created_at", "") // filled below after session load
      .order("created_at", { ascending: true }),
    admin
      .from("hotel_ar_cancellations")
      .select("id, ar_no, reason, cancelled_at, cancelled_by")
      .eq("session_id", sessionId)
      .order("cancelled_at", { ascending: true }),
  ]);
  if (!s) return null;
  const cancellerIds = (cancels ?? []).map((c) => c.cancelled_by as string);
  const names = await resolveNames(admin, [
    s.cashier_user_id as string,
    s.closed_by as string | null,
    ...cancellerIds,
  ]);

  // Re-query payments within session time window
  const { data: sessionPays } = await admin
    .from("stay_payments")
    .select("ar_no, amount, method, created_at")
    .gte("created_at", s.opened_at as string)
    .lte("created_at", (s.closed_at as string | null) ?? new Date().toISOString())
    .order("created_at", { ascending: true });

  void pays; // unused, replaced by sessionPays

  return {
    ...mapSessionRaw(s, names),
    payments: (sessionPays ?? []).map((p) => ({
      arNo: (p.ar_no as string | null) ?? null,
      amount: Number(p.amount),
      method: p.method as string,
      issuedAt: p.created_at as string,
    })),
    cancellations: (cancels ?? []).map((c) => ({
      id: c.id as string,
      arNo: c.ar_no as string,
      reason: c.reason as string,
      cancelledBy: names.get(c.cancelled_by as string) ?? "Unknown",
      cancelledAt: c.cancelled_at as string,
    })),
  };
}

/**
 * Next suggested AR number for the current cashier shift.
 * Bases the suggestion on the active session's beginning_ar_no + count of
 * payments already recorded since the session opened. Falls back to the
 * receipt_series sequence when no session is active.
 */
export async function getSuggestedNextArNo(): Promise<string> {
  const admin = createAdminClient();

  // Prefer active session: parse beginning_ar_no, offset by payment count.
  const { data: session } = await admin
    .from("hotel_cashier_sessions")
    .select("beginning_ar_no, opened_at")
    .is("closed_at", null)
    .maybeSingle();

  if (session?.beginning_ar_no) {
    const baseAr = session.beginning_ar_no as string;
    const { count } = await admin
      .from("stay_payments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", session.opened_at as string);
    const payCount = count ?? 0;
    const match = baseAr.match(/^([A-Za-z\-]+)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const padLen = match[2].length;
      const num = parseInt(match[2], 10) + payCount;
      return `${prefix}${String(num).padStart(padLen, "0")}`;
    }
    return baseAr;
  }

  // No active session — use the last closed session's ending_ar_no + 1
  const { data: lastSession } = await admin
    .from("hotel_cashier_sessions")
    .select("ending_ar_no, beginning_ar_no, opened_at, closed_at")
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastAr = (lastSession?.ending_ar_no as string | null)
    ?? (lastSession?.beginning_ar_no as string | null);

  if (lastAr) {
    const match = lastAr.match(/^([A-Za-z\-]+)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const padLen = match[2].length;
      const num = parseInt(match[2], 10) + 1;
      return `${prefix}${String(num).padStart(padLen, "0")}`;
    }
    return lastAr;
  }

  // Ultimate fallback: global receipt_series
  const { data } = await admin
    .from("receipt_series")
    .select("prefix, next_no")
    .eq("context", "hotel")
    .maybeSingle();
  if (!data) return "AR-000001";
  const pfx = (data.prefix as string) || "AR-";
  const no = data.next_no as number;
  return `${pfx}${String(no).padStart(6, "0")}`;
}

function mapSessionRaw(data: Record<string, unknown>, names: Map<string, string>): CashierSession {
  const cashierId = data.cashier_user_id as string;
  const closerId  = data.closed_by as string | null;
  return {
    id: data.id as string,
    cashierUserId: cashierId,
    cashierName: names.get(cashierId) ?? "Unknown",
    openedAt: data.opened_at as string,
    beginningArNo: data.beginning_ar_no as string,
    endingArNo: (data.ending_ar_no as string | null) ?? null,
    closedAt: (data.closed_at as string | null) ?? null,
    closedByName: closerId ? (names.get(closerId) ?? null) : null,
    notes: (data.notes as string | null) ?? null,
    shiftType: (data.shift_type as ShiftType | null) ?? null,
    collectionStartsAt: (data.collection_starts_at as string | null) ?? null,
    collectionEndsAt: (data.collection_ends_at as string | null) ?? null,
    bagDenominations: (data.bag_denominations as Record<string, number> | null) ?? null,
    baggedAt: (data.bagged_at as string | null) ?? null,
    bagSkipped: (data.bag_skipped as boolean | null) ?? false,
    bagSkippedReason: (data.bag_skipped_reason as string | null) ?? null,
  };
}

export interface ShiftCorrection {
  id: string;
  correctorName: string | null;
  correctedAt: string;
  paymentIndex: number | null;
  field: string;
  oldValue: string | null;
  newValue: string;
  reason: string;
}

export type PaymentRow = { arNo: string | null; guest: string; amount: number; method: string; paidAt: string };

export interface ShiftReport {
  id: string;
  sessionId: string;
  cashierName: string;
  shiftType: ShiftType | null;
  openedAt: string;
  closedAt: string;
  beginningArNo: string;
  endingArNo: string;
  paymentsJson: PaymentRow[];
  cancelledArsJson: { arNo: string; reason: string; loggedAt: string }[];
  totalCollected: number;
  arCount: number;
  cancelledCount: number;
  closedBySupervisor: boolean;
  status: "pending" | "acknowledged";
  acknowledgedAt: string | null;
  acknowledgedNotes: string | null;
  acknowledgedByName: string | null;
  createdAt: string;
  // Discrepancy
  expectedCollection: number | null;
  discrepancyAmount: number | null;
  discrepancyReason: string | null;
  extensionDetailsJson: unknown[];
  // Monitoring corrections
  corrections: ShiftCorrection[];
  // Collection window & cutoff split
  collectionStartsAt: string | null;
  collectionEndsAt: string | null;
  preCutoffTotal: number | null;
  preCutoffCount: number | null;
  postCutoffTotal: number | null;
  postCutoffCount: number | null;
  postCutoffPaymentsJson: PaymentRow[];
  // Cashier bag denominations (from hotel_cashier_sessions)
  bagDenominations: Record<string, number> | null;
  baggedAt: string | null;
  bagSkipped: boolean;
}

export async function getShiftReport(sessionId: string): Promise<ShiftReport | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_reports")
    .select("*, ack:acknowledged_by(full_name)")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!data) return null;

  const [corrResult, sessionResult] = await Promise.all([
    admin
      .from("hotel_shift_corrections")
      .select("id, corrector_name, corrected_at, payment_index, field, old_value, new_value, reason")
      .eq("report_id", (data as Record<string, unknown>).id as string)
      .order("corrected_at", { ascending: true }),
    admin
      .from("hotel_cashier_sessions")
      .select("bag_denominations, bagged_at, bag_skipped")
      .eq("id", sessionId)
      .maybeSingle(),
  ]);

  const sessionData = sessionResult.data as Record<string, unknown> | null;
  return mapReport(data, corrResult.data ?? [], sessionData);
}

export async function listPendingShiftReports(): Promise<ShiftReport[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_reports")
    .select("*, ack:acknowledged_by(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => mapReport(r as Record<string, unknown>));
}

export async function listShiftReports(limit = 20): Promise<ShiftReport[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_reports")
    .select("*, ack:acknowledged_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => mapReport(r as Record<string, unknown>));
}

function mapReport(data: Record<string, unknown>, corrRows: Record<string, unknown>[] = [], sessionData: Record<string, unknown> | null = null): ShiftReport {
  const ackRaw = data.ack;
  const ack = (ackRaw && !Array.isArray(ackRaw)) ? ackRaw as { full_name: string } : null;
  return {
    id: data.id as string,
    sessionId: data.session_id as string,
    cashierName: data.cashier_name as string,
    shiftType: (data.shift_type as ShiftType | null) ?? null,
    openedAt: data.opened_at as string,
    closedAt: data.closed_at as string,
    beginningArNo: data.beginning_ar_no as string,
    endingArNo: data.ending_ar_no as string,
    paymentsJson: (data.payments_json as ShiftReport["paymentsJson"]) ?? [],
    cancelledArsJson: (data.cancelled_ars_json as ShiftReport["cancelledArsJson"]) ?? [],
    totalCollected: Number(data.total_collected),
    arCount: data.ar_count as number,
    cancelledCount: data.cancelled_count as number,
    closedBySupervisor: data.closed_by_supervisor as boolean,
    status: data.status as "pending" | "acknowledged",
    acknowledgedAt: (data.acknowledged_at as string | null) ?? null,
    acknowledgedNotes: (data.acknowledged_notes as string | null) ?? null,
    acknowledgedByName: ack?.full_name ?? null,
    createdAt: data.created_at as string,
    expectedCollection: data.expected_collection != null ? Number(data.expected_collection) : null,
    discrepancyAmount: data.discrepancy_amount != null ? Number(data.discrepancy_amount) : null,
    discrepancyReason: (data.discrepancy_reason as string | null) ?? null,
    extensionDetailsJson: (data.extension_details_json as unknown[]) ?? [],
    corrections: corrRows.map((c) => ({
      id: c.id as string,
      correctorName: (c.corrector_name as string | null) ?? null,
      correctedAt: c.corrected_at as string,
      paymentIndex: c.payment_index != null ? Number(c.payment_index) : null,
      field: c.field as string,
      oldValue: (c.old_value as string | null) ?? null,
      newValue: c.new_value as string,
      reason: c.reason as string,
    })),
    collectionStartsAt: (data.collection_starts_at as string | null) ?? null,
    collectionEndsAt: (data.collection_ends_at as string | null) ?? null,
    preCutoffTotal: data.pre_cutoff_total != null ? Number(data.pre_cutoff_total) : null,
    preCutoffCount: data.pre_cutoff_count != null ? Number(data.pre_cutoff_count) : null,
    postCutoffTotal: data.post_cutoff_total != null ? Number(data.post_cutoff_total) : null,
    postCutoffCount: data.post_cutoff_count != null ? Number(data.post_cutoff_count) : null,
    postCutoffPaymentsJson: (data.post_cutoff_payments_json as ShiftReport["postCutoffPaymentsJson"]) ?? [],
    bagDenominations: (sessionData?.bag_denominations as Record<string, number> | null) ?? null,
    baggedAt: (sessionData?.bagged_at as string | null) ?? null,
    bagSkipped: (sessionData?.bag_skipped as boolean | null) ?? false,
  };
}

export interface CashierActivityEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorRoles: string[];
  createdAt: string;
  diff: Record<string, unknown> | null;
}

/** Returns audit log entries performed by the cashier during the given session window. */
export async function getCashierActivity(sessionId: string): Promise<CashierActivityEntry[]> {
  const admin = createAdminClient();
  const { data: session } = await admin
    .from("hotel_cashier_sessions")
    .select("cashier_user_id, opened_at, closed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return [];

  const from = session.opened_at as string;
  const to = (session.closed_at as string | null) ?? new Date().toISOString();

  const { data } = await admin
    .from("audit_log")
    .select("id, action, entity, entity_id, actor_roles, created_at, diff")
    .eq("actor_user_id", session.cashier_user_id as string)
    .gte("created_at", from)
    .lte("created_at", to)
    .in("entity", ["stays", "stay_payments", "hotel_cashier_sessions"])
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: r.action as string,
    entity: r.entity as string,
    entityId: (r.entity_id as string | null) ?? null,
    actorRoles: (r.actor_roles as string[]) ?? [],
    createdAt: r.created_at as string,
    diff: (r.diff as Record<string, unknown> | null) ?? null,
  }));
}

/** Check if the current user is the active cashier. Returns session or null. */
export async function getMyActiveSession(): Promise<CashierSession | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const active = await getActiveSession();
  if (!active || active.cashierUserId !== user.id) return null;
  return active;
}
