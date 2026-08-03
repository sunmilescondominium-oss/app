import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stayTotals } from "@/lib/hotel/rates";

export interface GuestStay {
  token: string;
  unitNumber: string;
  guest: string;
  status: string;
  checkInAt: string;
  plannedHours: number;
  baseHours: number;
  baseRate: number;
  extraHourRate: number;
  discountAmount: number;
  orders: { name: string; qty: number; amount: number }[];
  ordersTotal: number;
  paid: number;
  total: number;
  balance: number;
  checkoutRequested: boolean;
  extensionRequestedHours: number | null;
}

export async function getGuestStay(token: string): Promise<GuestStay | null> {
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("stays")
    .select("*, units(unit_number)")
    .eq("portal_token", token)
    .maybeSingle();
  if (!s) return null;

  const [{ data: ords }, { data: pays }] = await Promise.all([
    admin.from("stay_orders").select("name, qty, unit_price").eq("stay_id", s.id),
    admin.from("stay_payments").select("amount").eq("stay_id", s.id),
  ]);
  const orders = (ords ?? []).map((o) => ({ name: o.name as string, qty: Number(o.qty), amount: Number(o.qty) * Number(o.unit_price) }));
  const ordersTotal = orders.reduce((a, o) => a + o.amount, 0);
  const paid = (pays ?? []).reduce((a, p) => a + Number(p.amount), 0);
  const charge = stayTotals(
    {
      base_rate: Number(s.base_rate),
      extra_hour_rate: Number(s.extra_hour_rate),
      base_hours: Number(s.base_hours),
      planned_hours: Number(s.planned_hours),
      discount_amount: Number(s.discount_amount),
    },
    paid,
    ordersTotal,
  );

  return {
    token,
    unitNumber: ((s.units as { unit_number?: string } | null)?.unit_number as string) ?? "—",
    guest: s.guest_label as string,
    status: s.status as string,
    checkInAt: s.check_in_at as string,
    plannedHours: Number(s.planned_hours),
    baseHours: Number(s.base_hours),
    baseRate: Number(s.base_rate),
    extraHourRate: Number(s.extra_hour_rate),
    discountAmount: Number(s.discount_amount),
    orders,
    ordersTotal,
    paid,
    total: charge.total,
    balance: charge.balance,
    checkoutRequested: Boolean(s.checkout_requested),
    extensionRequestedHours: s.extension_requested_hours == null ? null : Number(s.extension_requested_hours),
  };
}
