"use client";

import { useActionState, useTransition } from "react";
import { startShift, endShift } from "@/app/(app)/guard/actions";
import type { GuardPost, GuardShift } from "@/lib/guard/queries";

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function ShiftPanel({
  posts,
  activeShift,
}: {
  posts: GuardPost[];
  activeShift: GuardShift | null;
}) {
  const [state, action, pending] = useActionState(startShift, undefined);
  const [endPending, startEnd] = useTransition();

  if (activeShift) {
    const started = new Date(activeShift.startedAt).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-emerald-800">
              🟢 On Duty — {activeShift.postName}
            </p>
            <p className="text-xs text-emerald-700">
              {activeShift.shiftType === "day" ? "Day shift" : "Night shift"} · started {started}
            </p>
          </div>
          <button
            type="button"
            disabled={endPending}
            onClick={() => startEnd(async () => { await endShift(activeShift.id); })}
            className="rounded-lg border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
          >
            {endPending ? "Ending…" : "End Shift"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-3 text-sm font-semibold text-amber-900">Start your guard shift</p>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Post</label>
          <select name="post_id" className={inputCls}>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[130px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Shift type</label>
          <select name="shift_type" className={inputCls}>
            <option value="day">Day (06:00–18:00)</option>
            <option value="night">Night (18:00–06:00)</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Starting…" : "Start Shift"}
        </button>
      </form>
      {state && !state.ok && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
    </div>
  );
}
