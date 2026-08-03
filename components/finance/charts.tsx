import { peso } from "@/lib/collections/summary";
import type { MonthPoint } from "@/lib/finance/types";

/** Horizontal bar chart — gross sales per business line (pure CSS, theme-safe). */
export function SalesByLineChart({ rows }: { rows: { label: string; gross: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.gross));
  if (rows.length === 0) return <p className="text-sm text-stone-400">No sales to chart.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate text-stone-600" title={r.label}>{r.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-stone-100">
            <div className="h-full rounded bg-amber-500" style={{ width: `${(r.gross / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums text-stone-700">{peso(r.gross)}</span>
        </div>
      ))}
    </div>
  );
}

/** Grouped vertical bars — income vs expense per month, with a net line label. */
export function MonthlyChart({ points }: { points: MonthPoint[] }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  if (points.length === 0) return <p className="text-sm text-stone-400">No monthly data.</p>;
  return (
    <div>
      <div className="flex h-40 items-end gap-3">
        {points.map((p) => (
          <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end justify-center gap-1">
              <div
                className="w-3 rounded-t bg-emerald-500"
                style={{ height: `${(p.income / max) * 100}%` }}
                title={`Income ${peso(p.income)}`}
              />
              <div
                className="w-3 rounded-t bg-rose-400"
                style={{ height: `${(p.expense / max) * 100}%` }}
                title={`Expense ${peso(p.expense)}`}
              />
            </div>
            <span className="text-[11px] text-stone-500">{p.month.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Income</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-400" />Expense</span>
      </div>
    </div>
  );
}
