/** Pure hotel rate math — reused by the live timer (client), folio, and checkout. */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** base_rate for the first base_hours, then extra_hour_rate per hour beyond. */
export function roomCharge(
  baseRate: number,
  extraHourRate: number,
  baseHours: number,
  plannedHours: number,
): number {
  const extra = Math.max(0, plannedHours - baseHours);
  return round2(baseRate + extra * extraHourRate);
}

export function promoDiscount(
  amount: number,
  discType?: string | null,
  discValue?: number | null,
): number {
  if (!discType || !discValue) return 0;
  if (discType === "percent") return round2(amount * (discValue / 100));
  return round2(Math.min(amount, discValue));
}

export interface StayCharge {
  room_charge: number;
  orders: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
}

/** Display totals from a stay's stored snapshot + orders + payments. */
export function stayTotals(
  stay: {
    base_rate: number;
    extra_hour_rate: number;
    base_hours: number;
    planned_hours: number;
    discount_amount: number;
  },
  paid: number,
  ordersTotal = 0,
): StayCharge {
  const rc = roomCharge(stay.base_rate, stay.extra_hour_rate, stay.base_hours, stay.planned_hours);
  const discount = round2(Math.min(rc, stay.discount_amount ?? 0));
  const orders = round2(ordersTotal);
  const total = round2(Math.max(0, rc - discount + orders));
  return {
    room_charge: rc,
    orders,
    discount,
    total,
    paid: round2(paid),
    balance: round2(Math.max(0, total - paid)),
  };
}

export function expectedOutIso(checkInIso: string, plannedHours: number): string {
  return new Date(new Date(checkInIso).getTime() + plannedHours * 3600 * 1000).toISOString();
}
