"use client";

import { useMemo, useState } from "react";
import { PHP_DENOMINATIONS } from "@/lib/config";
import { peso } from "@/lib/collections/summary";

/**
 * PHP bill/coin counter. Emits a hidden `denomination_counts` field (JSON map of
 * value → quantity) that the build action sums into the transmittal's counted cash.
 */
export function DenominationCounter() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const total = useMemo(
    () => PHP_DENOMINATIONS.reduce((s, d) => s + d.value * (counts[String(d.value)] ?? 0), 0),
    [counts],
  );

  function set(value: number, qty: number) {
    setCounts((c) => ({ ...c, [String(value)]: Math.max(0, Math.floor(qty) || 0) }));
  }

  return (
    <div className="no-print w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cash count (bills & coins)</p>
        <p className="text-sm font-semibold tabular-nums text-slate-800">Counted: {peso(total)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {PHP_DENOMINATIONS.map((d) => {
          const key = `${d.kind}-${d.value}`;
          const qty = counts[String(d.value)] ?? 0;
          return (
            <label key={key} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">{d.value < 1 ? `¢${d.value * 100}` : `₱${d.value}`}</span>
                <span className="text-[11px] tabular-nums text-slate-400">{peso(d.value * qty)}</span>
              </div>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                value={qty || ""}
                onChange={(e) => set(d.value, Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </label>
          );
        })}
      </div>
      <input type="hidden" name="denomination_counts" value={JSON.stringify(counts)} />
    </div>
  );
}
