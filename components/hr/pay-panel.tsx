"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setStaffPay } from "@/app/(app)/hr/actions";
import { peso } from "@/lib/collections/summary";

type Row = { userId: string; label: string; dailyRate: number };

function RateRow({ row }: { row: Row }) {
  const router = useRouter();
  const [rate, setRate] = useState(row.dailyRate);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await setStaffPay(row.userId, rate);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <tr className="border-b border-stone-100 last:border-0">
      <td className="px-4 py-2.5">{row.label}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{peso(row.dailyRate)}/day</td>
      <td className="px-4 py-2.5 text-right text-stone-400 tabular-nums">{peso(row.dailyRate / 8)}/hr</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-28 rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy || rate === row.dailyRate}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </td>
    </tr>
  );
}

export function PayPanel({ rows }: { rows: Row[] }) {
  return (
    <div className="no-print table-wrap">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">Staff</th>
            <th className="px-4 py-3 text-right">Daily rate</th>
            <th className="px-4 py-3 text-right">Hourly (÷8)</th>
            <th className="px-4 py-3 text-right">Set daily rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <RateRow key={r.userId} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
