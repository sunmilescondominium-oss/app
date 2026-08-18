import { COLLECTION_CATEGORIES, COLLECTION_CHARGE_TYPES } from "@/lib/config";
import type { Collection, DailySummary } from "./types";

export interface UnitChargeRow {
  charge_type: string;
  label: string;
  count: number;
  total: number;
}

export interface UnitSummaryRow {
  unit_id: string;
  unit_number: string;
  property_name?: string;
  charges: UnitChargeRow[];
  subtotal: number;
}

const CHARGE_LABEL: Record<string, string> = Object.fromEntries(
  COLLECTION_CHARGE_TYPES.map((c) => [c.key, c.label]),
);

/** Groups room-linked collections by unit then by charge_type for per-unit reporting. */
export function summarizeByUnit(cols: Collection[]): UnitSummaryRow[] {
  const byUnit = new Map<string, UnitSummaryRow>();
  for (const c of cols) {
    if (!c.unit_id || !c.unit) continue;
    if (!byUnit.has(c.unit_id)) {
      byUnit.set(c.unit_id, {
        unit_id: c.unit_id,
        unit_number: c.unit.unit_number,
        property_name: c.unit.property_name,
        charges: [],
        subtotal: 0,
      });
    }
    const row = byUnit.get(c.unit_id)!;
    const chargeKey = c.charge_type ?? "miscellaneous";
    const existing = row.charges.find((ch) => ch.charge_type === chargeKey);
    if (existing) {
      existing.count++;
      existing.total += Number(c.amount) || 0;
    } else {
      row.charges.push({
        charge_type: chargeKey,
        label: CHARGE_LABEL[chargeKey] ?? chargeKey,
        count: 1,
        total: Number(c.amount) || 0,
      });
    }
    row.subtotal += Number(c.amount) || 0;
  }
  return Array.from(byUnit.values()).sort((a, b) =>
    a.unit_number.localeCompare(b.unit_number),
  );
}

/** Pure — reused by the dashboard screen and the printable report. */
export function summarizeCollections(
  date: string,
  cols: Collection[],
): DailySummary {
  const byCat = new Map<string, { count: number; total: number }>();
  for (const c of cols) {
    const e = byCat.get(c.business_line) ?? { count: 0, total: 0 };
    e.count++;
    e.total += Number(c.amount) || 0;
    byCat.set(c.business_line, e);
  }
  const rows = COLLECTION_CATEGORIES.map((cat) => ({
    category: cat.key,
    label: cat.label,
    count: byCat.get(cat.key)?.count ?? 0,
    total: byCat.get(cat.key)?.total ?? 0,
  })).filter((r) => r.count > 0);

  const grandTotal = cols.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  return { date, rows, grandTotal, count: cols.length };
}

/** Peso formatting used across collections/transmittal screens. */
export function peso(n: number): string {
  return `₱${(Number(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Today's date (YYYY-MM-DD) in Manila time — the operating timezone. */
export function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(),
  );
}

const PH_LOCALE = "en-PH";
const PH_TZ = { timeZone: "Asia/Manila" } as const;

/** Format a timestamp as full date + time in any IANA timezone. */
export function fmtDateTime(iso: string | Date, tz: string): string {
  return new Date(iso).toLocaleString(PH_LOCALE, { timeZone: tz });
}

/** Format a timestamp as time-only (HH:MM AM/PM) in any IANA timezone. */
export function fmtTime(iso: string | Date, tz: string): string {
  return new Date(iso).toLocaleTimeString(PH_LOCALE, { timeZone: tz });
}

/** @deprecated Use fmtDateTime(iso, tz) with getAppTimezone(). */
export function fmtDateTimeManila(iso: string | Date): string {
  return new Date(iso).toLocaleString(PH_LOCALE, PH_TZ);
}

/** @deprecated Use fmtTime(iso, tz) with getAppTimezone(). */
export function fmtTimeManila(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString(PH_LOCALE, PH_TZ);
}
