"use client";

import { useTransition } from "react";
import { logExit } from "@/app/(app)/guard/actions";
import type { EntranceLogEntry } from "@/lib/guard/queries";

const ENTRY_ICONS: Record<string, string> = {
  guest: "🛎", vehicle: "🚗", visitor: "👤", delivery: "📦",
  staff: "🪪", unit_owner: "🏠", renter: "🔑", other: "⋯",
};

const ENTRY_LABELS: Record<string, string> = {
  guest: "Guest", vehicle: "Vehicle", visitor: "Visitor", delivery: "Delivery",
  staff: "Staff", unit_owner: "Owner", renter: "Renter", other: "Other",
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
    <div className="space-y-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className={`rounded-xl border bg-white p-3 ${e.timeOut ? "opacity-70" : ""}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span title={ENTRY_LABELS[e.entryType] ?? e.entryType}>
                  {ENTRY_ICONS[e.entryType] ?? "⋯"}
                </span>
                <span className="text-xs font-semibold text-stone-700">
                  {ENTRY_LABELS[e.entryType] ?? e.entryType}
                </span>
                {e.destinationUnit && (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                    {e.destinationUnit}
                  </span>
                )}
              </div>
              {e.visitorName && (
                <p className="mt-0.5 text-sm font-medium text-stone-800">{e.visitorName}</p>
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0 text-xs text-stone-500">
                {e.plateNumber && (
                  <span className="font-mono font-semibold">{e.plateNumber}</span>
                )}
                {e.vehicleType && <span className="capitalize">{e.vehicleType}</span>}
                {e.passengerCount != null && <span>{e.passengerCount} pax</span>}
                {e.driverName && <span>Driver: {e.driverName}</span>}
                {e.notes && <span className="italic">{e.notes}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-xs text-stone-500">{fmtTime(e.timeIn)}</span>
              {e.timeOut ? (
                <span className="font-mono text-xs text-stone-400">{fmtTime(e.timeOut)} out</span>
              ) : (
                <span className="text-[10px] font-semibold text-emerald-700">inside</span>
              )}
              {!e.timeOut && <ExitButton logId={e.id} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
