"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignShifts, type BulkResult } from "@/app/(app)/schedule/actions";

const cls = "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
// value = JS getUTCDay (0=Sun … 6=Sat); shown Mon-first.
const WEEKDAYS = [
  { v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" }, { v: 4, l: "Thu" },
  { v: 5, l: "Fri" }, { v: 6, l: "Sat" }, { v: 0, l: "Sun" },
];

export function BulkAssign({ staff, defaultFrom, defaultTo }: { staff: { id: string; label: string }[]; defaultFrom: string; defaultTo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, act, pending] = useActionState<BulkResult | undefined, FormData>(bulkAssignShifts, undefined);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allIds = staff.map((s) => s.id);
  const allPicked = picked.size === staff.length && staff.length > 0;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
        📅 Bulk assign
      </button>
    );
  }

  return (
    <form action={act} className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">Bulk assign shifts</p>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:underline">Close</button>
      </div>

      {/* Staff */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-stone-500">Staff ({picked.size} selected)</label>
          <button type="button" onClick={() => setPicked(allPicked ? new Set() : new Set(allIds))} className="text-xs font-medium text-indigo-700 hover:underline">
            {allPicked ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-stone-200 p-2 sm:grid-cols-3">
          {staff.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5 text-sm text-stone-700">
              <input type="checkbox" name="user_ids" value={s.id} checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="accent-indigo-600" />
              <span className="truncate">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-xs font-medium text-stone-500">From<input type="date" name="from" defaultValue={defaultFrom} required className={`${cls} mt-1 w-full`} /></label>
        <label className="text-xs font-medium text-stone-500">To<input type="date" name="to" defaultValue={defaultTo} required className={`${cls} mt-1 w-full`} /></label>
        <label className="text-xs font-medium text-stone-500">Start time<input type="time" name="start_time" defaultValue="08:00" className={`${cls} mt-1 w-full`} /></label>
        <label className="text-xs font-medium text-stone-500">End time<input type="time" name="end_time" defaultValue="17:00" className={`${cls} mt-1 w-full`} /></label>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-stone-500">Days</label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <label key={d.v} className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-700">
              <input type="checkbox" name="weekday" value={d.v} defaultChecked={d.v !== 0} className="accent-indigo-600" /> {d.l}
            </label>
          ))}
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" name="overwrite" className="accent-indigo-600" />
        Overwrite days that already have a shift (otherwise those days are skipped)
      </label>

      <label className="mt-2 block text-xs font-medium text-stone-500">Note (optional)<input name="note" className={`${cls} mt-1 w-full`} /></label>

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Assigning…" : "Assign shifts"}
        </button>
        {state?.ok && <span className="text-sm text-emerald-700">✓ {state.count} assignment(s) over {state.days} day(s).</span>}
        {state && !state.ok && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
