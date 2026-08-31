import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { roomCharge, round2 } from "@/lib/hotel/rates";

export interface ReportOrderLine {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
  isExtraPerson: boolean;
}

export interface ReportPayment {
  amount: number;
  method: string;
  paidAt: string;
  arNo: string | null;
  orNo: string | null;
  collectorName: string | null;
}

export interface StayReportEntry {
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  status: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  plannedHours: number;
  actualHours: number | null;
  roomChargeAmount: number;
  extraPersonsQty: number;
  extraPersonTotal: number;
  orders: ReportOrderLine[];
  discountAmount: number;
  subtotal: number;
  totalCharge: number;
  totalPaid: number;
  balance: number;
  payments: ReportPayment[];
}

type RawStay = {
  id: string;
  unit_id: string;
  guest_label: string;
  status: string;
  check_in_at: string;
  check_out_at: string | null;
  planned_hours: number;
  base_hours: number;
  base_rate: number;
  extra_hour_rate: number;
  extra_persons: number | null;
  extra_person_amount: number | null;
  discount_amount: number | null;
  units: { unit_number: string } | null;
  stay_orders: {
    name: string;
    qty: number;
    unit_price: number;
    menu_item_id: string | null;
  }[];
};

type RawCollection = {
  unit_id: string | null;
  amount: number;
  payment_type: string;
  ar_no: string | null;
  or_number: string | null;
  collector_name: string | null;
  created_at: string;
};

const SELECT = `
  id, unit_id, guest_label, status, check_in_at, check_out_at,
  planned_hours, base_hours, base_rate, extra_hour_rate,
  extra_persons, extra_person_amount, discount_amount,
  units:unit_id(unit_number),
  stay_orders(name, qty, unit_price, menu_item_id)
`.trim();

/** 30-minute grace: a payment entered just after checkout still belongs to that stay. */
const GRACE_MS = 30 * 60 * 1000;

function matchColsToStays(
  unitCols: RawCollection[],
  unitStays: RawStay[], // sorted ascending by check_in_at
): Map<string, RawCollection[]> {
  const stayColMap = new Map<string, RawCollection[]>(
    unitStays.map((s) => [s.id, []]),
  );

  for (const col of unitCols) {
    const colMs = new Date(col.created_at).getTime();
    let matched = false;

    for (const stay of unitStays) {
      const inMs  = new Date(stay.check_in_at).getTime();
      const outMs = stay.check_out_at
        ? new Date(stay.check_out_at).getTime() + GRACE_MS
        : Infinity;
      if (colMs >= inMs && colMs <= outMs) {
        stayColMap.get(stay.id)!.push(col);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Assign to the last stay whose check-in is before the collection time
      let best: RawStay | null = null;
      for (const stay of unitStays) {
        if (new Date(stay.check_in_at).getTime() <= colMs) best = stay;
      }
      if (!best) best = unitStays[0];
      stayColMap.get(best.id)!.push(col);
    }
  }

  return stayColMap;
}

function buildEntry(
  s: RawStay,
  stayCols: RawCollection[],
  fallbackUnitId: string,
): StayReportEntry {
  const rc = roomCharge(
    Number(s.base_rate),
    Number(s.extra_hour_rate),
    Number(s.base_hours),
    Number(s.planned_hours),
  );
  const extraPersonTotal = round2(Number(s.extra_person_amount ?? 0));
  const discountAmt = round2(Math.min(rc, Number(s.discount_amount ?? 0)));

  const orders: ReportOrderLine[] = (s.stay_orders ?? []).map((o) => ({
    name: o.name,
    qty: Number(o.qty),
    unitPrice: round2(Number(o.unit_price)),
    amount: round2(Number(o.qty) * Number(o.unit_price)),
    isExtraPerson: o.menu_item_id === null,
  }));

  const ordersTotal = orders.reduce((sum, o) => sum + o.amount, 0);
  const subtotal = round2(rc + extraPersonTotal + ordersTotal);
  const totalCharge = round2(Math.max(0, subtotal - discountAmt));

  const payments: ReportPayment[] = stayCols.map((c) => ({
    amount: round2(Number(c.amount)),
    method: c.payment_type,
    paidAt: c.created_at,
    arNo: c.ar_no ?? null,
    orNo: c.or_number ?? null,
    collectorName: c.collector_name ?? null,
  }));

  const totalPaid = round2(payments.reduce((sum, p) => sum + p.amount, 0));

  const actualHours = s.check_out_at
    ? round2(
        (new Date(s.check_out_at).getTime() - new Date(s.check_in_at).getTime()) /
          3_600_000,
      )
    : null;

  return {
    stayId: s.id,
    unitNumber: s.units?.unit_number ?? fallbackUnitId,
    guestLabel: s.guest_label,
    status: s.status,
    checkedInAt: s.check_in_at,
    checkedOutAt: s.check_out_at,
    plannedHours: Number(s.planned_hours),
    actualHours,
    roomChargeAmount: rc,
    extraPersonsQty: Number(s.extra_persons ?? 0),
    extraPersonTotal,
    orders,
    discountAmount: discountAmt,
    subtotal,
    totalCharge,
    totalPaid,
    balance: round2(totalCharge - totalPaid),
    payments,
  };
}

export async function listHotelCollectionReport(date: string): Promise<StayReportEntry[]> {
  const admin = createAdminClient();

  // Manila → UTC range (avoids '+' in query strings which can misfire as space)
  const startZ = new Date(date + "T00:00:00.000+08:00").toISOString();
  const endZ   = new Date(date + "T23:59:59.999+08:00").toISOString();

  // Step 1: hotel collections for this date → which units had activity
  const { data: cols } = await admin
    .from("collections")
    .select("unit_id, amount, payment_type, ar_no, or_number, collector_name, created_at")
    .eq("collected_on", date)
    .eq("business_line", "hotel")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (!cols?.length) return [];

  const collectionRows = cols as unknown as RawCollection[];
  const unitIds = [
    ...new Set(
      collectionRows.filter((c) => c.unit_id).map((c) => c.unit_id as string),
    ),
  ];

  // Step 2: ALL stays active on this date for those units (ascending so matching works)
  const { data: stayData } = await admin
    .from("stays")
    .select(SELECT)
    .in("unit_id", unitIds)
    .lte("check_in_at", endZ)
    .or(`check_out_at.is.null,check_out_at.gte.${startZ}`)
    .order("check_in_at", { ascending: true });

  // Group stays by unit_id (all stays, ascending)
  const staysByUnit = new Map<string, RawStay[]>();
  for (const s of (stayData as unknown as RawStay[]) ?? []) {
    const list = staysByUnit.get(s.unit_id) ?? [];
    list.push(s);
    staysByUnit.set(s.unit_id, list);
  }

  // Group collections by unit_id
  const colsByUnit = new Map<string, RawCollection[]>();
  for (const c of collectionRows) {
    if (!c.unit_id) continue;
    const list = colsByUnit.get(c.unit_id) ?? [];
    list.push(c);
    colsByUnit.set(c.unit_id, list);
  }

  const results: StayReportEntry[] = [];

  for (const unitId of unitIds) {
    const unitCols = colsByUnit.get(unitId) ?? [];
    const unitStays = staysByUnit.get(unitId) ?? [];

    if (unitStays.length === 0) {
      // No stay found — show a minimal entry so the collection isn't lost
      const totalPaid = round2(unitCols.reduce((sum, c) => sum + Number(c.amount), 0));
      results.push({
        stayId: unitId,
        unitNumber: unitId,
        guestLabel: "—",
        status: "unknown",
        checkedInAt: date + "T00:00:00+08:00",
        checkedOutAt: null,
        plannedHours: 0,
        actualHours: null,
        roomChargeAmount: 0,
        extraPersonsQty: 0,
        extraPersonTotal: 0,
        orders: [],
        discountAmount: 0,
        subtotal: totalPaid,
        totalCharge: totalPaid,
        totalPaid,
        balance: 0,
        payments: unitCols.map((c) => ({
          amount: round2(Number(c.amount)),
          method: c.payment_type,
          paidAt: c.created_at,
          arNo: c.ar_no ?? null,
          orNo: c.or_number ?? null,
          collectorName: c.collector_name ?? null,
        })),
      });
      continue;
    }

    // Match each collection to the correct stay by timestamp
    const stayColMap = matchColsToStays(unitCols, unitStays);

    for (const stay of unitStays) {
      const stayCols = stayColMap.get(stay.id) ?? [];
      // Skip stays with no payments AND no charges (avoid empty entries when a room
      // had an active stay but all payments were on other stays that day)
      if (stayCols.length === 0 && unitStays.length > 1) continue;
      results.push(buildEntry(stay, stayCols, unitId));
    }
  }

  // Sort by unit number then check-in time
  return results.sort((a, b) => {
    const u = a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
    if (u !== 0) return u;
    return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime();
  });
}
