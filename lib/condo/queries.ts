import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";

export interface CondoSettings {
  defaultRate: number;
  bankAccount: string | null;
  dueDay: number;
}

export interface CondoUnitRow {
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  areaSqm: number;
  effectiveRate: number;
  monthlyDues: number;
  unpaidTotal: number;
}

export async function getCondoSettings(): Promise<CondoSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("condo_settings").select("default_rate_per_sqm, bank_account, due_day").eq("id", 1).maybeSingle();
  return {
    defaultRate: Number(data?.default_rate_per_sqm ?? 0),
    bankAccount: (data?.bank_account as string | null) ?? null,
    dueDay: Number(data?.due_day ?? 15),
  };
}

async function rateMaps(admin: ReturnType<typeof createAdminClient>) {
  const [{ data: propRates }, settings] = await Promise.all([
    admin.from("condo_property_rates").select("property_id, rate_per_sqm"),
    getCondoSettings(),
  ]);
  const byProperty = new Map((propRates ?? []).map((r) => [r.property_id as string, Number(r.rate_per_sqm)]));
  return { byProperty, defaultRate: settings.defaultRate };
}

/** All condo units with their effective rate, monthly dues, and unpaid total. */
export async function condoUnits(): Promise<CondoUnitRow[]> {
  const admin = createAdminClient();
  const [{ data: units }, { data: dues }, rm] = await Promise.all([
    admin.from("units").select("id, unit_number, property_id, area_sqm, dues_rate_override, properties(name)").eq("business_line", "condo_sales").eq("is_active", true),
    admin.from("rental_dues").select("unit_id, amount, status"),
    rateMaps(createAdminClient()),
  ]);

  const unpaid = new Map<string, number>();
  for (const d of dues ?? []) if (d.status === "unpaid") unpaid.set(d.unit_id as string, (unpaid.get(d.unit_id as string) ?? 0) + Number(d.amount));

  return (units ?? [])
    .map((u) => {
      const area = Number(u.area_sqm ?? 0);
      const override = u.dues_rate_override == null ? null : Number(u.dues_rate_override);
      const effectiveRate = override ?? rm.byProperty.get(u.property_id as string) ?? rm.defaultRate;
      return {
        unitId: u.id as string,
        unitNumber: u.unit_number as string,
        propertyId: u.property_id as string,
        propertyName: ((u.properties as { name?: string } | null)?.name as string) ?? "—",
        areaSqm: area,
        effectiveRate,
        monthlyDues: Math.round(area * effectiveRate * 100) / 100,
        unpaidTotal: Math.round((unpaid.get(u.id as string) ?? 0) * 100) / 100,
      };
    })
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
}

export async function condoUnitDetail(unitId: string): Promise<CondoUnitRow | null> {
  const rows = await condoUnits();
  return rows.find((r) => r.unitId === unitId) ?? null;
}

export async function propertyRates(): Promise<{ id: string; name: string; rate: number }[]> {
  const admin = createAdminClient();
  const [{ data: props }, { data: rates }] = await Promise.all([
    admin.from("properties").select("id, name"),
    admin.from("condo_property_rates").select("property_id, rate_per_sqm"),
  ]);
  const byId = new Map((rates ?? []).map((r) => [r.property_id as string, Number(r.rate_per_sqm)]));
  return (props ?? []).map((p) => ({ id: p.id as string, name: p.name as string, rate: byId.get(p.id as string) ?? 0 })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Condo statement: unpaid dues + the common-area bank account. */
export async function condoBill(unitId: string): Promise<{ unit: CondoUnitRow; lines: { label: string; detail: string | null; amount: number }[]; total: number; bankAccount: string | null } | null> {
  const { RENTAL_DUE_CATEGORIES } = await import("@/lib/config");
  const label = Object.fromEntries(RENTAL_DUE_CATEGORIES.map((c) => [c.key, c.label]));
  const unit = await condoUnitDetail(unitId);
  if (!unit) return null;
  const admin = createAdminClient();
  const [{ data: dues }, settings] = await Promise.all([
    admin.from("rental_dues").select("category, amount, due_date, remarks, status").eq("unit_id", unitId).eq("status", "unpaid").order("due_date", { ascending: true }),
    getCondoSettings(),
  ]);
  const lines = (dues ?? []).map((d) => {
    const base = (label[d.category as string] as string) ?? (d.category as string);
    return { label: d.remarks ? `${base} — ${d.remarks}` : base, detail: d.due_date as string, amount: Number(d.amount) };
  });
  return { unit, lines, total: Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100, bankAccount: settings.bankAccount };
}

export function currentMonth(): string {
  return todayManila().slice(0, 7);
}
