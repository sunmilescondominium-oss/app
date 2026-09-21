import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface BreakdownLine {
  label: string;
  qty?: number;
  unit_price?: number;
  amount: number;
}

export interface PaymentBreakdown {
  lines: BreakdownLine[];
  subtotal: number;
  discount: number;
  total: number;
}

export interface ARRegisterEntry {
  paymentId: string;
  paidAt: string;
  unitNumber: string | null;
  guestLabel: string;
  method: string;
  amount: number;
  arNo: string | null;
  orNo: string | null;
  voidedAsTest: boolean;
  stayId: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  plannedHours: number | null;
  breakdown: PaymentBreakdown | null;
  edits: { oldArNo: string | null; newArNo: string | null; oldOrNo: string | null; newOrNo: string | null; reason: string; editedAt: string }[];
}

/** Extract the trailing integer from an AR string like "AR 205567" or "AR-000123". */
function extractArNum(ar: string | null | undefined): number {
  if (!ar) return NaN;
  const m = ar.replace(/\s+/g, "").match(/\d+$/);
  return m ? parseInt(m[0], 10) : NaN;
}

export interface ARRegisterOptions {
  /** ISO date string (YYYY-MM-DD) — filters by paid_at. Required when arFrom/arTo are absent. */
  date?: string;
  /** AR range start (inclusive) — text as entered, numeric suffix extracted. */
  arFrom?: string;
  /** AR range end (inclusive) — text as entered, numeric suffix extracted. */
  arTo?: string;
}

export async function listARRegister(dateOrOptions: string | ARRegisterOptions): Promise<ARRegisterEntry[]> {
  const admin = createAdminClient();

  const opts: ARRegisterOptions = typeof dateOrOptions === "string"
    ? { date: dateOrOptions }
    : dateOrOptions;

  const { date, arFrom, arTo } = opts;
  const hasArRange = !!(arFrom || arTo);

  let query = admin
    .from("stay_payments")
    .select("id, ar_no, receipt_no, amount, method, paid_at, stay_id, breakdown, stays(guest_label, voided_as_test, check_in_at, check_out_at, planned_hours, units:unit_id(unit_number))")
    .order("ar_no", { ascending: true })
    .order("paid_at", { ascending: true });

  if (date && !hasArRange) {
    const start = `${date}T00:00:00+08:00`;
    const end   = `${date}T23:59:59.999+08:00`;
    query = query.gte("paid_at", start).lte("paid_at", end);
  } else if (date && hasArRange) {
    // Both date and AR range — filter by date first for efficiency
    const start = `${date}T00:00:00+08:00`;
    const end   = `${date}T23:59:59.999+08:00`;
    query = query.gte("paid_at", start).lte("paid_at", end);
  } else {
    // AR range only — query last 365 days to avoid full table scan
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    query = query.gte("paid_at", cutoff.toISOString());
  }

  const { data: payments } = await query;

  if (!payments?.length) return [];

  const paymentIds = payments.map((p) => p.id as string);
  const { data: edits } = await admin
    .from("hotel_ar_edits")
    .select("payment_id, old_ar_no, new_ar_no, old_or_no, new_or_no, reason, edited_at")
    .in("payment_id", paymentIds)
    .order("edited_at", { ascending: true });

  const editsByPayment = new Map<string, ARRegisterEntry["edits"]>();
  for (const e of edits ?? []) {
    const pid = e.payment_id as string;
    if (!editsByPayment.has(pid)) editsByPayment.set(pid, []);
    editsByPayment.get(pid)!.push({
      oldArNo: (e.old_ar_no as string | null) ?? null,
      newArNo: (e.new_ar_no as string | null) ?? null,
      oldOrNo: (e.old_or_no as string | null) ?? null,
      newOrNo: (e.new_or_no as string | null) ?? null,
      reason: e.reason as string,
      editedAt: e.edited_at as string,
    });
  }

  const fromNum = extractArNum(arFrom);
  const toNum   = extractArNum(arTo);

  const mapped = payments.map((p) => {
    const stay = (p.stays && !Array.isArray(p.stays))
      ? p.stays as { guest_label: string; voided_as_test: boolean; check_in_at: string | null; check_out_at: string | null; planned_hours: number | null; units: { unit_number: string } | null }
      : null;
    const unit = stay?.units;
    return {
      paymentId: p.id as string,
      paidAt: p.paid_at as string,
      unitNumber: unit?.unit_number ?? null,
      guestLabel: stay?.guest_label ?? "—",
      method: p.method as string,
      amount: Number(p.amount),
      arNo: (p.ar_no as string | null) ?? null,
      orNo: (p.receipt_no as string | null) ?? null,
      voidedAsTest: stay?.voided_as_test ?? false,
      stayId: p.stay_id as string,
      checkedInAt: stay?.check_in_at ?? null,
      checkedOutAt: stay?.check_out_at ?? null,
      plannedHours: stay?.planned_hours ?? null,
      breakdown: (p.breakdown as PaymentBreakdown | null) ?? null,
      edits: editsByPayment.get(p.id as string) ?? [],
    };
  });

  // Apply AR range filter in JS (handles varied prefix formats like "AR 205567" vs "AR-000123")
  if (!isNaN(fromNum) || !isNaN(toNum)) {
    return mapped.filter((e) => {
      const n = extractArNum(e.arNo);
      if (isNaN(n)) return false;
      if (!isNaN(fromNum) && n < fromNum) return false;
      if (!isNaN(toNum)   && n > toNum)   return false;
      return true;
    });
  }

  return mapped;
}
