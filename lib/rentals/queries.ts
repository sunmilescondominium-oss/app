import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";
import { AIRBNB_CHECKOUT_SOON_HOURS, DUE_SOON_DAYS } from "@/lib/config";
import type { DueInfo, MeterRow, OccupancyRow, Reminder } from "./types";

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

export async function rentalUnitOptions(): Promise<{ id: string; label: string; businessLine: string }[]> {
  const admin = createAdminClient();
  const units = await unitsMap(admin);
  return units
    .map((u) => ({ id: u.id as string, label: `${u.unit_number}`, businessLine: u.business_line as string }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
