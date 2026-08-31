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
  voidedAsTest: boolean;
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
  guest_label: string;
  status: string;
  checked_in_at: string;
  checked_out_at: string | null;
  planned_hours: number;
  base_hours: number;
  base_rate: number;
  extra_hour_rate: number;
  extra_persons: number | null;
  extra_person_amount: number | null;
  discount_amount: number | null;
  units: { unit_number: string } | null;
  stay_payments: {
    amount: number;
    method: string;
    paid_at: string;
    ar_no: string | null;
    receipt_no: string | null;
    voided_as_test: boolean;
  }[];
  stay_orders: {
    name: string;
    qty: number;
    unit_price: number;
    menu_item_id: string | null;
  }[];
};

const SELECT = `
  id, guest_label, status, checked_in_at, checked_out_at,
  planned_hours, base_hours, base_rate, extra_hour_rate,
  extra_persons, extra_person_amount, discount_amount,
  units:unit_id(unit_number),
  stay_payments(amount, method, paid_at, ar_no, receipt_no, voided_as_test),
  stay_orders(name, qty, unit_price, menu_item_id)
`.trim();

export async function listHotelCollectionReport(date: string): Promise<StayReportEntry[]> {
  const admin = createAdminClient();
  const start = `${date}T00:00:00+08:00`;
  const end   = `${date}T23:59:59.999+08:00`;

  // Fetch stays checked in today + stays checked out today (overnight stays)
  const [{ data: checkedIn }, { data: checkedOut }] = await Promise.all([
    admin.from("stays").select(SELECT)
      .gte("checked_in_at", start).lte("checked_in_at", end)
      .neq("status", "cancelled")
      .order("checked_in_at", { ascending: true }),
    admin.from("stays").select(SELECT)
      .gte("checked_out_at", start).lte("checked_out_at", end)
      .lt("checked_in_at", start) // only those that started before today
      .neq("status", "cancelled")
      .order("checked_in_at", { ascending: true }),
  ]);

  // Merge and deduplicate by id
  const seen = new Set<string>();
  const rows: RawStay[] = [];
  const allRows = [
    ...((checkedIn as unknown as RawStay[]) ?? []),
    ...((checkedOut as unknown as RawStay[]) ?? []),
  ];
  for (const s of allRows) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      rows.push(s);
    }
  }

  return rows.map((s) => {
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
      isExtraPerson: o.menu_item_id === null, // extra persons added mid-stay have no menu_item_id
    }));

    const ordersTotal = orders.reduce((sum, o) => sum + o.amount, 0);
    const subtotal = round2(rc + extraPersonTotal + ordersTotal);
    const totalCharge = round2(Math.max(0, subtotal - discountAmt));

    const payments: ReportPayment[] = (s.stay_payments ?? []).map((p) => ({
      amount: round2(Number(p.amount)),
      method: p.method,
      paidAt: p.paid_at,
      arNo: p.ar_no ?? null,
      orNo: p.receipt_no ?? null,
      voidedAsTest: p.voided_as_test,
    }));

    const totalPaid = round2(
      payments.filter((p) => !p.voidedAsTest).reduce((sum, p) => sum + p.amount, 0),
    );

    const actualHours =
      s.checked_out_at
        ? round2(
            (new Date(s.checked_out_at).getTime() - new Date(s.checked_in_at).getTime()) /
              3_600_000,
          )
        : null;

    return {
      stayId: s.id,
      unitNumber: s.units?.unit_number ?? "—",
      guestLabel: s.guest_label,
      status: s.status,
      checkedInAt: s.checked_in_at,
      checkedOutAt: s.checked_out_at,
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
  });
}
