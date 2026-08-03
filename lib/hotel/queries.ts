import "server-only";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "./rates";
import type {
  RatePlan,
  Promo,
  Stay,
  StayPayment,
  StayOrder,
  MenuItem,
  RoomBoardItem,
  StayDetail,
  TaxSetting,
  RoomTaxRow,
  HotelDaySummary,
} from "./types";

function mapStay(r: Record<string, unknown>): Stay {
  const u = r.units as { unit_number: string } | null;
  const rp = r.rate_plans as { name: string } | null;
  return {
    id: r.id as string,
    unit_id: (r.unit_id as string) ?? null,
    guest_label: r.guest_label as string,
    guest_contact: (r.guest_contact as string) ?? null,
    rate_plan_id: (r.rate_plan_id as string) ?? null,
    planned_hours: r.planned_hours as number,
    base_hours: r.base_hours as number,
    base_rate: Number(r.base_rate),
    extra_hour_rate: Number(r.extra_hour_rate),
    promo_id: (r.promo_id as string) ?? null,
    discount_amount: Number(r.discount_amount),
    tax_mode: (r.tax_mode as string) ?? "none",
    tax_rate: Number(r.tax_rate ?? 0),
    check_in_at: r.check_in_at as string,
    check_out_at: (r.check_out_at as string) ?? null,
    status: r.status as string,
    portal_token: (r.portal_token as string | null) ?? null,
    checkout_requested: Boolean(r.checkout_requested),
    extension_requested_hours: r.extension_requested_hours == null ? null : Number(r.extension_requested_hours),
    unit: u ? { unit_number: u.unit_number } : null,
    rate_plan_name: rp?.name ?? null,
  };
}

export async function listRatePlans(): Promise<RatePlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rate_plans").select("*").eq("is_active", true).order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    base_hours: r.base_hours as number,
    base_rate: Number(r.base_rate),
    extra_hour_rate: Number(r.extra_hour_rate),
    sort_order: r.sort_order as number,
    is_active: r.is_active as boolean,
  }));
}

export async function listPromos(): Promise<Promo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("promos").select("*").eq("is_active", true).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    disc_type: r.disc_type as string,
    disc_value: Number(r.disc_value),
    is_active: r.is_active as boolean,
  }));
}

export async function listMenuItems(): Promise<MenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("hotel_menu_items").select("*").eq("is_active", true).order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    category: r.category as string,
    name: r.name as string,
    price: Number(r.price),
    sort_order: r.sort_order as number,
    is_active: r.is_active as boolean,
  }));
}

export async function getGlobalTax(): Promise<TaxSetting> {
  const supabase = await createClient();
  const { data } = await supabase.from("hotel_tax_settings").select("tax_mode, tax_rate").eq("id", 1).maybeSingle();
  return { tax_mode: (data?.tax_mode as string) ?? "none", tax_rate: Number(data?.tax_rate ?? 0) };
}

export async function listRoomTax(): Promise<RoomTaxRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("room_tax").select("unit_id, tax_mode, tax_rate, units(unit_number)");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    unit_id: r.unit_id as string,
    unit_number: (r.units as { unit_number?: string } | null)?.unit_number,
    tax_mode: r.tax_mode as string,
    tax_rate: Number(r.tax_rate),
  }));
}

export async function listRoomBoard(): Promise<RoomBoardItem[]> {
  const supabase = await createClient();
  const [{ data: units }, { data: stays }, { data: hk }] = await Promise.all([
    supabase.from("units").select("id, unit_number, unit_type").eq("business_line", "hotel").eq("is_active", true).order("unit_number", { ascending: true }),
    supabase.from("stays").select("*, units(unit_number)").eq("status", "active"),
    supabase.from("housekeeping_tasks").select("unit_id").in("status", ["pending", "in_progress"]),
  ]);
  const stayByUnit = new Map<string, Stay>();
  for (const s of (stays ?? []).map(mapStay)) if (s.unit_id) stayByUnit.set(s.unit_id, s);
  const dirty = new Set((hk ?? []).map((t) => t.unit_id as string).filter(Boolean));
  return (units ?? []).map((u: Record<string, unknown>) => ({
    unit: { id: u.id as string, unit_number: u.unit_number as string, unit_type: (u.unit_type as string) ?? null },
    stay: stayByUnit.get(u.id as string) ?? null,
    needsHousekeeping: dirty.has(u.id as string),
  }));
}

export async function getStayDetail(id: string): Promise<StayDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stays").select("*, units(unit_number), rate_plans(name)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [{ data: pays }, { data: ords }] = await Promise.all([
    supabase.from("stay_payments").select("*").eq("stay_id", id).order("paid_at", { ascending: true }),
    supabase.from("stay_orders").select("*").eq("stay_id", id).order("ordered_at", { ascending: true }),
  ]);

  const stay = mapStay(data);
  const payments: StayPayment[] = (pays ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    stay_id: p.stay_id as string,
    method: p.method as string,
    amount: Number(p.amount),
    receipt_no: (p.receipt_no as string) ?? null,
    ar_no: (p.ar_no as string) ?? null,
    paid_at: p.paid_at as string,
  }));
  const orders: StayOrder[] = (ords ?? []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    stay_id: o.stay_id as string,
    menu_item_id: (o.menu_item_id as string) ?? null,
    name: o.name as string,
    qty: o.qty as number,
    unit_price: Number(o.unit_price),
  }));

  return { stay, payments, orders, unit_number: stay.unit?.unit_number ?? null, rate_plan_name: stay.rate_plan_name ?? null };
}

export async function getLatestRoomCheck(
  stayId: string,
): Promise<{ gatepass_no: string | null; checked_at: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("room_checks")
    .select("gatepass_no, checked_at")
    .eq("stay_id", stayId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { gatepass_no: (data.gatepass_no as string) ?? null, checked_at: data.checked_at as string } : null;
}

// ---- day-end / remittance summary ----------------------------------------
function manilaDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(iso));
}
function addDaysIso(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export async function getHotelDaySummary(date: string): Promise<HotelDaySummary> {
  const supabase = await createClient();
  const from = `${addDaysIso(date, -3)}T00:00:00Z`;
  const to = `${addDaysIso(date, 2)}T00:00:00Z`;

  const [{ data: stays }, { data: pays }] = await Promise.all([
    supabase.from("stays").select("check_in_at, check_out_at, guest_label, units(unit_number)").gte("check_in_at", from),
    supabase.from("stay_payments").select("amount, method, paid_at").gte("paid_at", from).lt("paid_at", to),
  ]);

  const checkIns: HotelDaySummary["checkIns"] = [];
  const checkOuts: HotelDaySummary["checkOuts"] = [];
  let totalHours = 0;
  for (const s of (stays ?? []) as Record<string, unknown>[]) {
    const unit = (s.units as { unit_number?: string } | null)?.unit_number ?? "—";
    const guest = s.guest_label as string;
    if (manilaDate(s.check_in_at as string) === date) checkIns.push({ unit, guest, at: s.check_in_at as string });
    const co = s.check_out_at as string | null;
    if (co && manilaDate(co) === date) {
      const hrs = (new Date(co).getTime() - new Date(s.check_in_at as string).getTime()) / 3600000;
      totalHours += hrs;
      checkOuts.push({ unit, guest, at: co, hours: Math.round(hrs * 10) / 10 });
    }
  }

  const dayPays = ((pays ?? []) as { amount: number; method: string; paid_at: string }[]).filter(
    (p) => manilaDate(p.paid_at) === date,
  );
  const collectionsTotal = round2(dayPays.reduce((s, p) => s + Number(p.amount), 0));
  const byMethodMap = new Map<string, number>();
  for (const p of dayPays) byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? 0) + Number(p.amount));

  return {
    date,
    checkInCount: checkIns.length,
    checkOutCount: checkOuts.length,
    checkIns,
    checkOuts,
    totalOccupiedHours: Math.round(totalHours * 10) / 10,
    collectionsTotal,
    paymentCount: dayPays.length,
    byMethod: [...byMethodMap].map(([method, total]) => ({ method, total: round2(total) })),
  };
}
