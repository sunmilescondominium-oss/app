"use client";

import { useTransition } from "react";
import { logExit } from "@/app/(app)/guard/actions";
import type { EntranceLogEntry } from "@/lib/guard/queries";

const ENTRY_ICONS: Record<string, string> = {
  guest: "🛎", vehicle: "🚗", visitor: "👤", delivery: "📦", staff: "🪪",
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
  });
}

function ExitButton({ logId }: { logId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await logExit(logId); })}
      className="rounded-md border border-stone-300 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-100 disabled:opacity-50"
    >
      {pending ? "…" : "Out"}
    </button>
  );
}

export function EntranceLogList({ entries }: { entries: EntranceLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-400">
        No entries logged today at this post.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="px-3 py-2">Time In</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Plate</th>
            <th className="px-3 py-2">Vehicle</th>
            <th className="px-3 py-2">Pax</th>
            <th className="px-3 py-2">Driver / Notes</th>
            <th className="px-3 py-2">Time Out</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{fmtTime(e.timeIn)}</td>
              <td className="px-3 py-2">
                <span title={e.entryType}>{ENTRY_ICONS[e.entryType] ?? "—"}</span>
              </td>
              <td className="px-3 py-2 font-mono text-xs font-semibold">{e.plateNumber ?? "—"}</td>
              <td className="px-3 py-2 text-xs capitalize">{e.vehicleType ?? "—"}</td>
              <td className="px-3 py-2 text-xs">{e.passengerCount ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-stone-500">
                {e.driverName ? <span className="block">{e.driverName}</span> : null}
                {e.notes ? <span className="block italic">{e.notes}</span> : null}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                {e.timeOut ? (
                  <span className="text-stone-400">{fmtTime(e.timeOut)}</span>
                ) : (
                  <span className="font-semibold text-emerald-700">still inside</span>
                )}
              </td>
              <td className="px-3 py-2">
                {!e.timeOut && <ExitButton logId={e.id} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
