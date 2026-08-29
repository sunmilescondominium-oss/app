import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { round2, stayTotals } from "./rates";
import type {
  RatePlan,
  Promo,
  Stay,
  StayPayment,
  StayOrder,
  StayExtension,
  MenuItem,
  RoomBoardItem,
  StayDetail,
  TaxSetting,
  RoomTaxRow,
  HotelDaySummary,
  RoomTransferRecord,
  MaintenanceIssue,
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
    discount_type: (r.discount_type as string | null) ?? null,
    discount_id_photo_path: (r.discount_id_photo_path as string | null) ?? null,
    discount_id_photo_expires_at: (r.discount_id_photo_expires_at as string | null) ?? null,
    tax_mode: (r.tax_mode as string) ?? "none",
    tax_rate: Number(r.tax_rate ?? 0),
    check_in_at: r.check_in_at as string,
    check_out_at: (r.check_out_at as string) ?? null,
    status: r.status as string,
    portal_token: (r.portal_token as string | null) ?? null,
    checkout_requested: Boolean(r.checkout_requested),
    extension_requested_hours: r.extension_requested_hours == null ? null : Number(r.extension_requested_hours),
    extra_persons: Number(r.extra_persons ?? 0),
    extra_person_rate: Number(r.extra_person_rate ?? 0),
    extra_person_amount: Number(r.extra_person_amount ?? 0),
    transfer_from_stay_id: (r.transfer_from_stay_id as string | null) ?? null,
    unit: u ? { unit_number: u.unit_number } : null,
    rate_plan_name: rp?.name ?? null,
  };
}

export async function listRatePlans(): Promise<RatePlan[]> {
  const supabase = createAdminClient();
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
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("promos").select("*").eq("is_active", true).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    disc_type: r.disc_type as string,
    disc_value: Number(r.disc_value),
    is_active: r.is_active as boolean,
    valid_from: (r.valid_from as string | null) ?? null,
    valid_until: (r.valid_until as string | null) ?? null,
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

function mapMaintenanceIssue(r: Record<string, unknown>): MaintenanceIssue {
  return {
    id: r.id as string,
    unit_id: r.unit_id as string,
    transfer_id: (r.transfer_id as string) ?? null,
    description: r.description as string,
    status: r.status as MaintenanceIssue["status"],
    reporter_name: (r.reporter_name as string) ?? null,
    reported_at: r.reported_at as string,
    resolver_name: (r.resolver_name as string) ?? null,
    resolved_at: (r.resolved_at as string) ?? null,
    fix_report: (r.fix_report as string) ?? null,
    stays_after_fix: Number(r.stays_after_fix ?? 0),
    visible_until: (r.visible_until as string) ?? null,
  };
}

export async function getMaintenanceIssueForUnit(unitId: string): Promise<MaintenanceIssue | null> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("hotel_maintenance_issues")
    .select("*")
    .eq("unit_id", unitId)
    .or(`status.in.(open,in_progress),and(status.eq.resolved,stays_after_fix.lt.5,visible_until.gt.${now})`)
    .order("reported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapMaintenanceIssue(data as Record<string, unknown>) : null;
}

export async function listRoomBoard(isDemoMode = false): Promise<RoomBoardItem[]> {
  const supabase = await createClient();
  const [{ data: units }, { data: stays }, { data: hk }] = await Promise.all([
    supabase.from("units").select("id, unit_number, unit_type, extra_person_rate").eq("business_line", "hotel").eq("is_active", true).eq("is_demo", isDemoMode).order("unit_number", { ascending: true }),
    supabase.from("stays").select("*, units(unit_number), rate_plans(name)").eq("status", "active").eq("is_demo", isDemoMode),
    supabase.from("housekeeping_tasks").select("unit_id").in("status", ["pending", "in_progress"]),
  ]);
  const stayByUnit = new Map<string, Stay>();
  const mappedStays = (stays ?? []).map(mapStay);
  for (const s of mappedStays) if (s.unit_id) stayByUnit.set(s.unit_id, s);
  const dirty = new Set((hk ?? []).map((t) => t.unit_id as string).filter(Boolean));

  const unitIds = (units ?? []).map((u: Record<string, unknown>) => u.id as string);
  const stayIds = mappedStays.map((s) => s.id);
  const now = new Date().toISOString();

  // Parallel: folio totals + maintenance issues + last checkout + last cleaner
  const [
    { data: pays }, { data: ords },
    { data: maintRows },
    { data: recentCheckouts },
    { data: recentHkTasks },
  ] = await Promise.all([
    stayIds.length
      ? supabase.from("stay_payments").select("stay_id, amount").in("stay_id", stayIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    stayIds.length
      ? supabase.from("stay_orders").select("stay_id, qty, unit_price").in("stay_id", stayIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    unitIds.length
      ? supabase.from("hotel_maintenance_issues").select("*").in("unit_id", unitIds)
          .or(`status.in.(open,in_progress),and(status.eq.resolved,stays_after_fix.lt.5,visible_until.gt.${now})`)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    unitIds.length
      ? supabase.from("stays").select("unit_id, check_out_at").in("unit_id", unitIds)
          .not("check_out_at", "is", null).order("check_out_at", { ascending: false }).limit(unitIds.length * 2)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    unitIds.length
      ? supabase.from("housekeeping_tasks").select("unit_id, completed_at, completed_by_name")
          .in("unit_id", unitIds).eq("status", "done").not("completed_at", "is", null)
          .order("completed_at", { ascending: false }).limit(unitIds.length * 2)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  // Build folio totals map
  const totalsByStay = new Map<string, { paid: number; ordersTotal: number; balance: number }>();
  const paidBy = new Map<string, number>();
  for (const p of pays ?? []) paidBy.set(p.stay_id as string, (paidBy.get(p.stay_id as string) ?? 0) + Number(p.amount));
  const ordersBy = new Map<string, number>();
  for (const o of ords ?? []) ordersBy.set(o.stay_id as string, (ordersBy.get(o.stay_id as string) ?? 0) + Number(o.qty) * Number(o.unit_price));
  for (const s of mappedStays) {
    const paid = paidBy.get(s.id) ?? 0;
    const ordersTotal = ordersBy.get(s.id) ?? 0;
    totalsByStay.set(s.id, { paid, ordersTotal, balance: stayTotals(s, paid, ordersTotal).balance });
  }

  // Build maintenance issue map (most recent per unit)
  const issueByUnit = new Map<string, MaintenanceIssue>();
  for (const row of maintRows ?? []) {
    const r = row as Record<string, unknown>;
    const uid = r.unit_id as string;
    const existing = issueByUnit.get(uid);
    if (!existing || new Date(r.reported_at as string) > new Date(existing.reported_at)) {
      issueByUnit.set(uid, mapMaintenanceIssue(r));
    }
  }

  // Build last checkout map (most recent per unit)
  const lastCheckoutByUnit = new Map<string, string>();
  for (const s of recentCheckouts ?? []) {
    const r = s as Record<string, unknown>;
    if (!lastCheckoutByUnit.has(r.unit_id as string)) {
      lastCheckoutByUnit.set(r.unit_id as string, r.check_out_at as string);
    }
  }

  // Build last cleaner map (most recent completed HK task per unit)
  const lastCleanerByUnit = new Map<string, string | null>();
  for (const t of recentHkTasks ?? []) {
    const r = t as Record<string, unknown>;
    if (!lastCleanerByUnit.has(r.unit_id as string)) {
      lastCleanerByUnit.set(r.unit_id as string, (r.completed_by_name as string) ?? null);
    }
  }

  return (units ?? []).map((u: Record<string, unknown>) => {
    const unitId = u.id as string;
    const stay = stayByUnit.get(unitId) ?? null;
    const t = stay ? totalsByStay.get(stay.id) : undefined;
    const lastCoAt = lastCheckoutByUnit.get(unitId);
    return {
      unit: { id: unitId, unit_number: u.unit_number as string, unit_type: (u.unit_type as string) ?? null, extra_person_rate: Number(u.extra_person_rate ?? 0) },
      stay,
      needsHousekeeping: dirty.has(unitId),
      paid: t?.paid, ordersTotal: t?.ordersTotal, balance: t?.balance,
      lastCheckout: lastCoAt ? { at: lastCoAt, cleaner_name: lastCleanerByUnit.get(unitId) ?? null } : null,
      maintenanceIssue: issueByUnit.get(unitId) ?? null,
    };
  });
}

export async function getStayDetail(id: string): Promise<StayDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stays").select("*, units(unit_number), rate_plans(name)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [{ data: pays }, { data: ords }, { data: exts }] = await Promise.all([
    supabase.from("stay_payments").select("*").eq("stay_id", id).order("paid_at", { ascending: true }),
    supabase.from("stay_orders").select("*").eq("stay_id", id).order("ordered_at", { ascending: true }),
    supabase.from("stay_extensions").select("*").eq("stay_id", id).order("created_at", { ascending: true }),
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
    payment_note: (p.payment_note as string) ?? null,
  }));
  const orders: StayOrder[] = (ords ?? []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    stay_id: o.stay_id as string,
    menu_item_id: (o.menu_item_id as string) ?? null,
    name: o.name as string,
    qty: o.qty as number,
    unit_price: Number(o.unit_price),
  }));
  const extensions: StayExtension[] = (exts ?? []).map((e: Record<string, unknown>) => ({
    id: e.id as string,
    stay_id: e.stay_id as string,
    added_hours: Number(e.added_hours),
    created_at: e.created_at as string,
  }));

  return { stay, payments, orders, extensions, unit_number: stay.unit?.unit_number ?? null, rate_plan_name: stay.rate_plan_name ?? null };
}

function mapTransfer(r: Record<string, unknown>): RoomTransferRecord {
  const fu = r.from_unit as { unit_number: string } | null;
  const tu = r.to_unit as { unit_number: string } | null;
  const pr = r.profiles as { display_label: string } | null;
  return {
    id: r.id as string,
    from_stay_id: r.from_stay_id as string,
    to_stay_id: (r.to_stay_id as string) ?? null,
    from_unit_number: fu?.unit_number ?? "—",
    to_unit_number: tu?.unit_number ?? "—",
    within_10_min: Boolean(r.within_10_min),
    transfer_reason: r.transfer_reason as string,
    remarks: (r.remarks as string) ?? null,
    performed_by: (r.performed_by as string) ?? null,
    performer_name: pr?.display_label ?? null,
    transferred_at: r.transferred_at as string,
  };
}

export async function getTransferRecord(stayId: string): Promise<RoomTransferRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_room_transfers")
    .select("*, from_unit:from_unit_id(unit_number), to_unit:to_unit_id(unit_number), profiles:performed_by(display_label)")
    .or(`from_stay_id.eq.${stayId},to_stay_id.eq.${stayId}`)
    .order("transferred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return mapTransfer(data as Record<string, unknown>);
}

export async function listRoomTransfers(opts?: { limit?: number; offset?: number }): Promise<RoomTransferRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_room_transfers")
    .select("*, from_unit:from_unit_id(unit_number), to_unit:to_unit_id(unit_number), profiles:performed_by(display_label)")
    .order("transferred_at", { ascending: false })
    .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);
  return (data ?? []).map((r) => mapTransfer(r as Record<string, unknown>));
}

export async function getExtraPersonRate(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("hotel_extra_settings").select("extra_person_rate").eq("id", 1).maybeSingle();
  return Number(data?.extra_person_rate ?? 0);
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
