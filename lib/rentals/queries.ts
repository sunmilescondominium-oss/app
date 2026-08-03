import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";
import { AIRBNB_CHECKOUT_SOON_HOURS, DUE_SOON_DAYS } from "@/lib/config";
import type { DueInfo, MeterRow, OccupancyRow, Reminder, UnitDetail } from "./types";

/** SERVICE ROLE — gated by requireModule("rentals") at the page. */

type Admin = ReturnType<typeof createAdminClient>;

function dueFlags(dueDate: string): { overdue: boolean; dueSoon: boolean } {
  const today = todayManila();
  const days = Math.round((new Date(dueDate).getTime() - new Date(today).getTime()) / 86_400_000);
  return { overdue: days < 0, dueSoon: days >= 0 && days <= DUE_SOON_DAYS };
}

async function unitsMap(admin: Admin) {
  const { data } = await admin
    .from("units")
    .select("id, unit_number, business_line, status, is_active, properties(name)")
    .in("business_line", ["rental", "airbnb"])
    .eq("is_active", true);
  return data ?? [];
}

export async function occupancyBoard(): Promise<OccupancyRow[]> {
  const admin = createAdminClient();
  const units = await unitsMap(admin);
  const ids = units.map((u) => u.id as string);
  const guard = ids.length ? ids : ["__none__"];

  const [{ data: leases }, { data: dues }, { data: hk }] = await Promise.all([
    admin.from("leases").select("id, unit_id, tenant_label, contact, end_at, rent_amount, billing_cycle").eq("status", "active").in("unit_id", guard),
    admin.from("rental_dues").select("id, unit_id, category, amount, due_date, status").eq("status", "unpaid").in("unit_id", guard).order("due_date", { ascending: true }),
    admin.from("housekeeping_tasks").select("unit_id").in("status", ["pending", "in_progress"]).in("unit_id", guard),
  ]);

  type DueRow = NonNullable<typeof dues>[number];
  const dirty = new Set((hk ?? []).map((t) => t.unit_id as string).filter(Boolean));
  const leaseByUnit = new Map((leases ?? []).map((l) => [l.unit_id as string, l]));
  const dueByUnit = new Map<string, DueRow>();
  for (const d of dues ?? []) if (!dueByUnit.has(d.unit_id as string)) dueByUnit.set(d.unit_id as string, d);

  const now = Date.now();
  return units
    .map((u) => {
      const l = leaseByUnit.get(u.id as string);
      const d = dueByUnit.get(u.id as string);
      const endAt = (l?.end_at as string | null) ?? null;
      const checkoutInMins = endAt ? Math.round((new Date(endAt).getTime() - now) / 60_000) : null;
      const nextDue: DueInfo | null = d
        ? { id: d.id as string, category: d.category as string, amount: Number(d.amount), dueDate: d.due_date as string, status: d.status as string, ...dueFlags(d.due_date as string) }
        : null;
      return {
        unitId: u.id as string,
        unitNumber: u.unit_number as string,
        propertyName: ((u.properties as { name?: string } | null)?.name as string) ?? "—",
        businessLine: u.business_line as string,
        unitStatus: u.status as string,
        lease: l
          ? { id: l.id as string, tenantLabel: l.tenant_label as string, contact: (l.contact as string | null) ?? null, endAt, rentAmount: Number(l.rent_amount), billingCycle: l.billing_cycle as string }
          : null,
        checkoutInMins,
        checkoutSoon:
          u.business_line === "airbnb" && checkoutInMins != null && checkoutInMins <= AIRBNB_CHECKOUT_SOON_HOURS * 60,
        needsHousekeeping: !l && dirty.has(u.id as string),
        nextDue,
      };
    })
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
}

export async function listDues(): Promise<(DueInfo & { unitNumber: string })[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("rental_dues")
    .select("id, unit_id, category, amount, due_date, status, units(unit_number)")
    .order("due_date", { ascending: true })
    .limit(200);
  return (data ?? []).map((d) => ({
    id: d.id as string,
    category: d.category as string,
    amount: Number(d.amount),
    dueDate: d.due_date as string,
    status: d.status as string,
    unitNumber: ((d.units as { unit_number?: string } | null)?.unit_number as string) ?? "—",
    ...dueFlags(d.due_date as string),
  }));
}

export async function listMeterReadings(): Promise<MeterRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("meter_readings")
    .select("id, unit_id, utility, reading, read_on, units(unit_number)")
    .order("read_on", { ascending: false })
    .limit(100);
  const rows = data ?? [];

  // Consumption = this reading − the previous reading for the same unit+utility.
  const asc = [...rows].sort((a, b) => (a.read_on as string).localeCompare(b.read_on as string));
  const prev = new Map<string, number>();
  const consumptionById = new Map<string, number>();
  for (const r of asc) {
    const key = `${r.unit_id}|${r.utility}`;
    const last = prev.get(key);
    if (last != null) consumptionById.set(r.id as string, Math.round((Number(r.reading) - last) * 100) / 100);
    prev.set(key, Number(r.reading));
  }

  return rows.map((r) => ({
    id: r.id as string,
    unitId: r.unit_id as string,
    unitNumber: ((r.units as { unit_number?: string } | null)?.unit_number as string) ?? "—",
    utility: r.utility as string,
    reading: Number(r.reading),
    readOn: r.read_on as string,
    consumption: consumptionById.get(r.id as string) ?? null,
  }));
}

/** Staff reminders: near Airbnb checkouts + overdue/soon dues. */
export async function reminders(board: OccupancyRow[]): Promise<Reminder[]> {
  const out: Reminder[] = [];
  for (const r of board) {
    if (r.checkoutSoon && r.checkoutInMins != null) {
      const mins = r.checkoutInMins;
      out.push({
        kind: "checkout",
        label: `${r.unitNumber} — ${r.lease?.tenantLabel ?? "guest"}`,
        detail: mins < 0 ? `checkout overdue by ${Math.abs(mins)} min` : `checkout in ${mins} min`,
        tone: mins < 0 ? "red" : "amber",
      });
    }
    if (r.nextDue && (r.nextDue.overdue || r.nextDue.dueSoon)) {
      out.push({
        kind: "due",
        label: `${r.unitNumber} — ${r.nextDue.category}`,
        detail: `${r.nextDue.overdue ? "overdue" : "due"} ${r.nextDue.dueDate}`,
        tone: r.nextDue.overdue ? "red" : "amber",
      });
    }
  }
  return out;
}

export async function rentalUnitDetail(unitId: string): Promise<UnitDetail | null> {
  const admin = createAdminClient();
  const { data: u } = await admin
    .from("units")
    .select("id, unit_number, business_line, status, is_active, properties(name)")
    .eq("id", unitId)
    .maybeSingle();
  if (!u || !["rental", "airbnb"].includes(u.business_line as string)) return null;

  const [{ data: lease }, { data: hk }] = await Promise.all([
    admin.from("leases").select("*").eq("unit_id", unitId).eq("status", "active").maybeSingle(),
    admin.from("housekeeping_tasks").select("id").eq("unit_id", unitId).in("status", ["pending", "in_progress"]).maybeSingle(),
  ]);

  return {
    unitId,
    unitNumber: u.unit_number as string,
    propertyName: ((u.properties as { name?: string } | null)?.name as string) ?? "—",
    businessLine: u.business_line as string,
    unitStatus: u.status as string,
    lease: lease
      ? {
          id: lease.id as string,
          tenantLabel: lease.tenant_label as string,
          contact: (lease.contact as string | null) ?? null,
          endAt: (lease.end_at as string | null) ?? null,
          rentAmount: Number(lease.rent_amount),
          billingCycle: lease.billing_cycle as string,
          startDate: lease.start_date as string,
          deposit: Number(lease.deposit),
          notes: (lease.notes as string | null) ?? null,
        }
      : null,
    needsHousekeeping: !lease && Boolean(hk),
  };
}

export async function duesForUnit(unitId: string): Promise<(DueInfo & { paidOn: string | null; remarks: string | null })[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("rental_dues")
    .select("id, category, amount, due_date, status, paid_on, remarks")
    .eq("unit_id", unitId)
    .order("due_date", { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id as string,
    category: d.category as string,
    amount: Number(d.amount),
    dueDate: d.due_date as string,
    status: d.status as string,
    paidOn: (d.paid_on as string | null) ?? null,
    remarks: (d.remarks as string | null) ?? null,
    ...dueFlags(d.due_date as string),
  }));
}

export async function metersForUnit(unitId: string): Promise<MeterRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("meter_readings")
    .select("id, unit_id, utility, reading, read_on, units(unit_number)")
    .eq("unit_id", unitId)
    .order("read_on", { ascending: false });
  const rows = data ?? [];
  const asc = [...rows].sort((a, b) => (a.read_on as string).localeCompare(b.read_on as string));
  const prev = new Map<string, number>();
  const cons = new Map<string, number>();
  for (const r of asc) {
    const last = prev.get(r.utility as string);
    if (last != null) cons.set(r.id as string, Math.round((Number(r.reading) - last) * 100) / 100);
    prev.set(r.utility as string, Number(r.reading));
  }
  return rows.map((r) => ({
    id: r.id as string,
    unitId: r.unit_id as string,
    unitNumber: ((r.units as { unit_number?: string } | null)?.unit_number as string) ?? "—",
    utility: r.utility as string,
    reading: Number(r.reading),
    readOn: r.read_on as string,
    consumption: cons.get(r.id as string) ?? null,
  }));
}

export interface BillLine {
  label: string;
  detail: string | null;
  amount: number;
}

/** Monthly billing statement — monthly rent + all unpaid dues for the unit. */
export async function unitBill(unitId: string): Promise<{
  unit: UnitDetail;
  lines: BillLine[];
  total: number;
} | null> {
  const { RENTAL_DUE_CATEGORIES } = await import("@/lib/config");
  const label = Object.fromEntries(RENTAL_DUE_CATEGORIES.map((c) => [c.key, c.label]));
  const unit = await rentalUnitDetail(unitId);
  if (!unit) return null;

  const dues = await duesForUnit(unitId);
  const lines: BillLine[] = [];
  if (unit.lease && unit.lease.billingCycle === "monthly" && unit.lease.rentAmount > 0) {
    lines.push({ label: "Monthly rent", detail: null, amount: unit.lease.rentAmount });
  }
  for (const d of dues.filter((x) => x.status === "unpaid")) {
    const base = (label[d.category] as string) ?? d.category;
    lines.push({
      label: d.remarks ? `${base} — ${d.remarks}` : base,
      detail: d.dueDate,
      amount: d.amount,
    });
  }
  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return { unit, lines, total };
}

export async function rentalUnitOptions(): Promise<{ id: string; label: string; businessLine: string }[]> {
  const admin = createAdminClient();
  const units = await unitsMap(admin);
  return units
    .map((u) => ({ id: u.id as string, label: `${u.unit_number}`, businessLine: u.business_line as string }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
