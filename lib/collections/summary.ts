import { COLLECTION_CATEGORIES } from "@/lib/config";
import type { Collection, DailySummary } from "./types";

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
