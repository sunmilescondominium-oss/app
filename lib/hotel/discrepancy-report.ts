import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShiftReport } from "@/lib/hotel/session";
import { stayTotals, round2 } from "@/lib/hotel/rates";
import type { ShiftReport } from "@/lib/hotel/session";

export interface StayDiscrepancyRow {
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  checkInAt: string;
  checkOutAt: string | null;
  plannedHours: number;
  actualHours: number | null;
  roomCharge: number;
  ordersTotal: number;
  discount: number;
  totalCharge: number;
  totalPaid: number;
  balance: number;
  shortfallAmount: number | null;
  shortfallReason: string | null;
  isForced: boolean;
  paymentMethods: { method: string; amount: number }[];
  arNos: string[];
  hasNoAr: boolean;
}

export interface MethodSplit {
  method: string;
  total: number;
  count: number;
  pct: number;
}

export interface DiscrepancyFinding {
  severity: "high" | "medium" | "low";
  category: string;
  text: string;
}

export interface CollectionDiscrepancyReport {
  session: ShiftReport;
  stays: StayDiscrepancyRow[];
  methodSplit: MethodSplit[];
  arGaps: string[];
  findings: DiscrepancyFinding[];
  totalExpected: number;
  totalCollected: number;
  variance: number;
  totalShortfall: number;
  totalUnpaidBalance: number;
  totalForcedCheckouts: number;
}

function parseArNumber(ar: string): { prefix: string; num: number; padLen: number } | null {
  const m = ar.match(/^([A-Za-z\-]+)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10), padLen: m[2].length };
}

export async function getCollectionDiscrepancyReport(
  sessionId: string,
): Promise<CollectionDiscrepancyReport | null> {
  const report = await getShiftReport(sessionId);
  if (!report) return null;

  const admin = createAdminClient();

  // All stays checked out during this session window
  const { data: rawStays } = await admin
    .from("stays")
    .select("id, unit_id, guest_label, check_in_at, check_out_at, planned_hours, base_hours, base_rate, extra_hour_rate, discount_amount, extra_person_amount, shortfall_amount, shortfall_reason, shortfall_forced_at, status, units(unit_number)")
    .gte("check_out_at", report.openedAt)
    .lte("check_out_at", report.closedAt)
    .neq("status", "active");

  // Also grab any stays that were checked in during the window (still active or checked out after)
  const { data: rawCheckIns } = await admin
    .from("stays")
    .select("id, unit_id, guest_label, check_in_at, check_out_at, planned_hours, base_hours, base_rate, extra_hour_rate, discount_amount, extra_person_amount, shortfall_amount, shortfall_reason, shortfall_forced_at, status, units(unit_number)")
    .gte("check_in_at", report.openedAt)
    .lte("check_in_at", report.closedAt);

  // Merge and deduplicate
  const allRaw = new Map<string, Record<string, unknown>>();
  for (const s of [...(rawStays ?? []), ...(rawCheckIns ?? [])]) {
    allRaw.set(s.id as string, s as Record<string, unknown>);
  }
  const stayIds = [...allRaw.keys()];

  if (stayIds.length === 0) {
    const emptyReport = buildEmptyReport(report);
    return emptyReport;
  }

  // Payments per stay
  const { data: allPayments } = await admin
    .from("stay_payments")
    .select("stay_id, amount, method, ar_no")
    .in("stay_id", stayIds);

  // Orders per stay
  const { data: allOrders } = await admin
    .from("stay_orders")
    .select("stay_id, qty, unit_price")
    .in("stay_id", stayIds);

  // Group payments/orders by stay
  const paysByStay = new Map<string, { amount: number; method: string; ar_no: string | null }[]>();
  const ordsByStay = new Map<string, number>();

  for (const p of allPayments ?? []) {
    const sid = p.stay_id as string;
    if (!paysByStay.has(sid)) paysByStay.set(sid, []);
    paysByStay.get(sid)!.push({ amount: Number(p.amount), method: p.method as string, ar_no: (p.ar_no as string | null) ?? null });
  }
  for (const o of allOrders ?? []) {
    const sid = o.stay_id as string;
    ordsByStay.set(sid, (ordsByStay.get(sid) ?? 0) + Number(o.qty) * Number(o.unit_price));
  }

  const stays: StayDiscrepancyRow[] = [];

  for (const [sid, r] of allRaw) {
    const pays = paysByStay.get(sid) ?? [];
    const ordersTotal = ordsByStay.get(sid) ?? 0;
    const totalPaid = round2(pays.reduce((s, p) => s + p.amount, 0));
    const charge = stayTotals(
      {
        base_rate: Number(r.base_rate),
        extra_hour_rate: Number(r.extra_hour_rate),
        base_hours: Number(r.base_hours),
        planned_hours: Number(r.planned_hours),
        discount_amount: Number(r.discount_amount ?? 0),
        extra_person_amount: Number(r.extra_person_amount ?? 0),
      },
      totalPaid,
      ordersTotal,
    );

    // Actual hours stayed (for checked-out stays)
    let actualHours: number | null = null;
    if (r.check_out_at && r.check_in_at) {
      actualHours = round2((new Date(r.check_out_at as string).getTime() - new Date(r.check_in_at as string).getTime()) / 3_600_000);
    }

    // Payment method breakdown for this stay
    const methodMap = new Map<string, number>();
    for (const p of pays) {
      methodMap.set(p.method, (methodMap.get(p.method) ?? 0) + p.amount);
    }

    const arNos = pays.map((p) => p.ar_no).filter(Boolean) as string[];
    const unit = r.units as { unit_number?: string } | null;

    stays.push({
      stayId: sid,
      unitNumber: unit?.unit_number ?? "—",
      guestLabel: r.guest_label as string,
      checkInAt: r.check_in_at as string,
      checkOutAt: (r.check_out_at as string | null) ?? null,
      plannedHours: Number(r.planned_hours),
      actualHours,
      roomCharge: charge.room_charge,
      ordersTotal: charge.orders,
      discount: charge.discount,
      totalCharge: charge.total,
      totalPaid,
      balance: charge.balance,
      shortfallAmount: r.shortfall_amount != null ? Number(r.shortfall_amount) : null,
      shortfallReason: (r.shortfall_reason as string | null) ?? null,
      isForced: r.shortfall_forced_at != null,
      paymentMethods: [...methodMap.entries()].map(([method, amount]) => ({ method, amount: round2(amount) })),
      arNos,
      hasNoAr: arNos.length === 0 && totalPaid > 0,
    });
  }

  // Sort: forced checkouts first, then by balance desc
  stays.sort((a, b) => {
    if (a.isForced && !b.isForced) return -1;
    if (!a.isForced && b.isForced) return 1;
    return b.balance - a.balance;
  });

  // Payment method split (from shift report payments_json)
  const methodMap = new Map<string, { total: number; count: number }>();
  for (const p of report.paymentsJson) {
    const k = p.method;
    const prev = methodMap.get(k) ?? { total: 0, count: 0 };
    methodMap.set(k, { total: round2(prev.total + p.amount), count: prev.count + 1 });
  }
  const grandTotal = round2([...methodMap.values()].reduce((s, v) => s + v.total, 0)) || 1;
  const methodSplit: MethodSplit[] = [...methodMap.entries()]
    .map(([method, { total, count }]) => ({
      method,
      total,
      count,
      pct: Math.round((total / grandTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.total - a.total);

  // AR gap detection
  const arGaps: string[] = [];
  const beginAr = parseArNumber(report.beginningArNo);
  const endAr = report.endingArNo ? parseArNumber(report.endingArNo) : null;
  if (beginAr && endAr && beginAr.prefix === endAr.prefix) {
    const expected = new Set<string>();
    for (let n = beginAr.num; n <= endAr.num; n++) {
      expected.add(`${beginAr.prefix}${String(n).padStart(beginAr.padLen, "0")}`);
    }
    const issued = new Set(report.paymentsJson.map((p) => p.arNo).filter(Boolean) as string[]);
    const cancelled = new Set(report.cancelledArsJson.map((c) => c.arNo));
    for (const ar of expected) {
      if (!issued.has(ar) && !cancelled.has(ar)) arGaps.push(ar);
    }
  }

  // Derive findings
  const totalExpected = report.expectedCollection ?? stays.reduce((s, r) => s + r.totalCharge, 0);
  const totalCollected = report.totalCollected;
  const variance = round2(totalExpected - totalCollected);
  const totalShortfall = round2(stays.filter((s) => s.isForced).reduce((s, r) => s + (r.shortfallAmount ?? 0), 0));
  const totalUnpaidBalance = round2(stays.filter((s) => !s.isForced && s.balance > 0.01).reduce((s, r) => s + r.balance, 0));
  const totalForcedCheckouts = stays.filter((s) => s.isForced).length;

  const findings: DiscrepancyFinding[] = [];

  if (variance === 0) {
    findings.push({ severity: "low", category: "Collection match", text: "System expected and actual collections match exactly — no financial variance detected." });
  }

  if (totalForcedCheckouts > 0) {
    findings.push({
      severity: "high",
      category: "Forced checkouts",
      text: `${totalForcedCheckouts} stay${totalForcedCheckouts > 1 ? "s were" : " was"} force-checked-out with an unresolved balance of ₱${totalShortfall.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. This accounts for ${variance > 0 ? Math.round((totalShortfall / variance) * 100) + "%" : "part"} of the variance. The cashier's stated reasons are listed per stay — verify whether cash was actually received.`,
    });
  }

  if (totalUnpaidBalance > 0.01) {
    const count = stays.filter((s) => !s.isForced && s.balance > 0.01).length;
    findings.push({
      severity: "medium",
      category: "Unpaid balances",
      text: `${count} stay${count > 1 ? "s have" : " has"} an unpaid balance totalling ₱${totalUnpaidBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })} that was not force-checked-out. These may indicate payments collected but not recorded in the system, or genuinely unpaid bills.`,
    });
  }

  if (arGaps.length > 0) {
    findings.push({
      severity: arGaps.length > 2 ? "high" : "medium",
      category: "AR number gaps",
      text: `${arGaps.length} AR number${arGaps.length > 1 ? "s" : ""} in the cashier's assigned range ${arGaps.length <= 5 ? `(${arGaps.join(", ")}) ` : ""}${arGaps.length > 1 ? "are" : "is"} missing — not in any recorded payment and not listed as voided. These may indicate unrecorded transactions or voided receipts not logged through the system.`,
    });
  }

  if (stays.some((s) => s.hasNoAr)) {
    const count = stays.filter((s) => s.hasNoAr).length;
    findings.push({
      severity: "medium",
      category: "Payments without AR",
      text: `${count} stay${count > 1 ? "s have" : " has"} payments recorded without an AR number. This makes the collection harder to trace — ensure the cashier issues AR receipts for all payments.`,
    });
  }

  const cashEntry = methodSplit.find((m) => m.method === "cash");
  const digitalTotal = round2(methodSplit.filter((m) => m.method !== "cash").reduce((s, m) => s + m.total, 0));
  if (variance > 0 && cashEntry) {
    if (cashEntry.total >= variance) {
      findings.push({
        severity: "medium",
        category: "Cash shortfall likely",
        text: `Variance of ₱${variance.toLocaleString("en-PH", { minimumFractionDigits: 2 })} is within the cash collections total of ₱${cashEntry.total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. Digital payments (₱${digitalTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}) can be verified against bank/GCash statements. Focus the physical count review on cash.`,
      });
    } else {
      findings.push({
        severity: "high",
        category: "Variance exceeds cash collections",
        text: `Variance of ₱${variance.toLocaleString("en-PH", { minimumFractionDigits: 2 })} exceeds total cash collected (₱${cashEntry.total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}). This suggests the shortfall may span multiple payment types or that some transactions were not recorded at all.`,
      });
    }
  }

  if (report.corrections.length > 0) {
    findings.push({
      severity: "low",
      category: "Monitoring corrections made",
      text: `Monitoring made ${report.corrections.length} correction${report.corrections.length > 1 ? "s" : ""} to this shift report after submission. Check the corrections log on the shift report for details.`,
    });
  }

  if (variance === 0 && totalShortfall === 0 && arGaps.length === 0 && totalUnpaidBalance <= 0.01 && findings.length === 1) {
    // Only the "match" finding
  } else if (variance > 0 && findings.filter((f) => f.severity === "high").length === 0) {
    findings.push({
      severity: "low",
      category: "Overall assessment",
      text: "No high-severity findings. The variance may be within acceptable range — verify the denomination bag count against the system total before concluding.",
    });
  }

  return {
    session: report,
    stays,
    methodSplit,
    arGaps,
    findings,
    totalExpected,
    totalCollected,
    variance,
    totalShortfall,
    totalUnpaidBalance,
    totalForcedCheckouts,
  };
}

function buildEmptyReport(report: ShiftReport): CollectionDiscrepancyReport {
  return {
    session: report,
    stays: [],
    methodSplit: [],
    arGaps: [],
    findings: [{ severity: "low", category: "No transactions", text: "No stays were checked in or out during this shift window. If this seems incorrect, the session dates may not match any transaction records." }],
    totalExpected: report.expectedCollection ?? 0,
    totalCollected: report.totalCollected,
    variance: round2((report.expectedCollection ?? 0) - report.totalCollected),
    totalShortfall: 0,
    totalUnpaidBalance: 0,
    totalForcedCheckouts: 0,
  };
}
