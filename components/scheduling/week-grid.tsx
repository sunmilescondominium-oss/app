"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { quickAssignShift, removeShift } from "@/app/(app)/schedule/actions";
import type { WeekCell } from "@/lib/scheduling/queries";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekGrid({
  staff,
  days,
  cells,
  today,
}: {
  staff: { id: string; label: string }[];
  days: string[];
  cells: Record<string, WeekCell>;
  today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(userId: string, date: string, cell: WeekCell | undefined) {
    const key = `${userId}|${date}`;
    setBusy(key);
    const res = cell ? await removeShift(cell.id) : await quickAssignShift(userId, date);
    setBusy(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="table-wrap">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-3 py-2.5">Staff</th>
            {days.map((d, i) => (
              <th key={d} className={`px-2 py-2.5 text-center ${d === today ? "text-amber-700" : ""}`}>
                <div>{DOW[i]}</div>
                <div className="font-normal">{d.slice(5)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-6 text-center text-stone-500">No staff to schedule.</td></tr>
          )}
          {staff.map((s) => (
            <tr key={s.id} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2 font-medium text-stone-800">{s.label}</td>
              {days.map((d) => {
                const key = `${s.id}|${d}`;
                const cell = cells[key];
                const isBusy = busy === key;
                return (
                  <td key={d} className={`px-1.5 py-1.5 text-center ${d === today ? "bg-amber-50" : ""}`}>
                    <button
                      type="button"
                      onClick={() => toggle(s.id, d, cell)}
                      disabled={isBusy}
                      title={cell ? "Click to remove" : "Click to assign default shift"}
                      className={`w-full rounded px-1.5 py-1 text-xs tabular-nums transition disabled:opacity-50 ${
                        cell
                          ? "bg-emerald-100 text-emerald-800 hover:bg-rose-100 hover:text-rose-700"
                          : "text-stone-300 hover:bg-stone-100 hover:text-stone-500"
                      }`}
                    >
                      {isBusy ? "…" : cell ? (cell.start ? `${cell.start.slice(0, 5)}–${cell.end?.slice(0, 5) ?? "?"}` : "✓") : "+"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
