"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  presetDates,
  PRESET_LABELS,
  type PeriodPreset,
  type CompareMode,
} from "@/lib/finance/periods";

const PRESETS: PeriodPreset[] = ["today", "week", "month", "quarter", "year", "custom"];
const COMPARE_OPTIONS: { value: CompareMode; label: string }[] = [
  { value: "none", label: "No comparison" },
  { value: "prev_period", label: "Prev period" },
  { value: "prev_year", label: "Same period last year" },
];
const TREND_OPTS = [3, 6, 12];

interface Props {
  from: string;
  to: string;
  preset: PeriodPreset;
  compare: CompareMode;
  months: number;
}

export function PeriodFilter({ from, to, preset, compare, months }: Props) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function push(p: Record<string, string>) {
    router.push(`?${new URLSearchParams(p).toString()}`);
  }

  function selectPreset(p: PeriodPreset) {
    if (p === "custom") {
      push({ preset: "custom", from: customFrom, to: customTo, compare, months: String(months) });
      return;
    }
    const [f, t] = presetDates(p);
    push({ preset: p, from: f, to: t, compare, months: String(months) });
  }

  const btnBase = "rounded-lg px-3 py-1.5 text-sm font-medium transition";
  const btnActive = "bg-stone-800 text-white";
  const btnIdle = "border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100";
  const chipActive = "bg-amber-100 text-amber-800 font-semibold";
  const chipIdle = "border border-stone-200 text-stone-600 hover:bg-stone-50";
  const chipBase = "rounded-md px-2.5 py-1 text-xs font-medium transition";
  const inputCls =
    "rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <div className="no-print mb-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => selectPreset(p)} className={`${btnBase} ${preset === p ? btnActive : btnIdle}`}>
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-3 border-t border-stone-100 pt-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">From</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">To</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={inputCls} />
          </div>
          <button
            onClick={() => push({ preset: "custom", from: customFrom, to: customTo, compare, months: String(months) })}
            className="rounded-lg bg-stone-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-900"
          >
            Apply
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stone-100 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Compare</span>
          <div className="flex gap-1">
            {COMPARE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => push({ preset, from, to, compare: o.value, months: String(months) })}
                className={`${chipBase} ${compare === o.value ? chipActive : chipIdle}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Trend</span>
          <div className="flex gap-1">
            {TREND_OPTS.map((n) => (
              <button
                key={n}
                onClick={() => push({ preset, from, to, compare, months: String(n) })}
                className={`${chipBase} ${months === n ? chipActive : chipIdle}`}
              >
                {n}M
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
