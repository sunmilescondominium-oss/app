import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  // Fallback: global receipt_series
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
  };
}

export interface ShiftReport {
  id: string;
  sessionId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  beginningArNo: string;
  endingArNo: string;
  paymentsJson: { arNo: string | null; guest: string; amount: number; method: string; paidAt: string }[];
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
}

export async function getShiftReport(sessionId: string): Promise<ShiftReport | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_reports")
    .select("*, ack:acknowledged_by(full_name)")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!data) return null;
  return mapReport(data);
}

export async function listPendingShiftReports(): Promise<ShiftReport[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_reports")
    .select("*, ack:acknowledged_by(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapReport);
}

export async function listShiftReports(limit = 20): Promise<ShiftReport[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_reports")
    .select("*, ack:acknowledged_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapReport);
}

function mapReport(data: Record<string, unknown>): ShiftReport {
  const ackRaw = data.ack;
  const ack = (ackRaw && !Array.isArray(ackRaw)) ? ackRaw as { full_name: string } : null;
  return {
    id: data.id as string,
    sessionId: data.session_id as string,
    cashierName: data.cashier_name as string,
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
  };
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
