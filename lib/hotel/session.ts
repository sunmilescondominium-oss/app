import "server-only";
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

/** Returns the currently open (unclosed) cashier session, or null if no one is on duty. */
export async function getActiveSession(): Promise<CashierSession | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_cashier_sessions")
    .select("*, cashier:cashier_user_id(full_name), closer:closed_by(full_name)")
    .is("closed_at", null)
    .maybeSingle();
  if (!data) return null;
  return mapSession(data);
}

/** Returns paginated session history (most recent first). */
export async function getSessionHistory(limit = 20): Promise<CashierSession[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_cashier_sessions")
    .select("*, cashier:cashier_user_id(full_name), closer:closed_by(full_name)")
    .order("opened_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapSession);
}

/** Full session detail: session + payments with AR nos + cancelled ARs. */
export async function getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const admin = createAdminClient();
  const [{ data: s }, { data: pays }, { data: cancels }] = await Promise.all([
    admin
      .from("hotel_cashier_sessions")
      .select("*, cashier:cashier_user_id(full_name), closer:closed_by(full_name)")
      .eq("id", sessionId)
      .maybeSingle(),
    admin
      .from("stay_payments")
      .select("ar_no, amount, method, created_at")
      .gte("created_at", "") // filled below after session load
      .order("created_at", { ascending: true }),
    admin
      .from("hotel_ar_cancellations")
      .select("id, ar_no, reason, cancelled_at, canceller:cancelled_by(full_name)")
      .eq("session_id", sessionId)
      .order("cancelled_at", { ascending: true }),
  ]);
  if (!s) return null;

  // Re-query payments within session time window
  const { data: sessionPays } = await admin
    .from("stay_payments")
    .select("ar_no, amount, method, created_at")
    .gte("created_at", s.opened_at as string)
    .lte("created_at", (s.closed_at as string | null) ?? new Date().toISOString())
    .order("created_at", { ascending: true });

  void pays; // unused, replaced by sessionPays

  return {
    ...mapSession(s),
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
      cancelledBy: (c.canceller && !Array.isArray(c.canceller) ? (c.canceller as { full_name: string }).full_name : null) ?? "Unknown",
      cancelledAt: c.cancelled_at as string,
    })),
  };
}

/** Next suggested AR number (current receipt_series next_no, formatted). */
export async function getSuggestedNextArNo(): Promise<string> {
  const admin = createAdminClient();
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

function mapSession(data: Record<string, unknown>): CashierSession {
  const cashierRaw = data.cashier;
  const closerRaw  = data.closer;
  const cashier = (cashierRaw && !Array.isArray(cashierRaw)) ? cashierRaw as { full_name: string } : null;
  const closer  = (closerRaw  && !Array.isArray(closerRaw))  ? closerRaw  as { full_name: string } : null;
  return {
    id: data.id as string,
    cashierUserId: data.cashier_user_id as string,
    cashierName: cashier?.full_name ?? "Unknown",
    openedAt: data.opened_at as string,
    beginningArNo: data.beginning_ar_no as string,
    endingArNo: (data.ending_ar_no as string | null) ?? null,
    closedAt: (data.closed_at as string | null) ?? null,
    closedByName: closer?.full_name ?? null,
    notes: (data.notes as string | null) ?? null,
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
