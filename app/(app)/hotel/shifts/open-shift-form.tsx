"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openShift } from "./actions";

const cls = "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 w-full";

/** Detect Day (06:00–17:59 Manila) vs Night (18:00–05:59 Manila) from current time. */
function detectShiftType(): 'day' | 'night' {
  const hour = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hour12: false });
  const h = parseInt(hour, 10);
  return h >= 6 && h < 18 ? 'day' : 'night';
}

const SHIFT_LABELS = {
  day:   { label: "Day Shift",   time: "6:00 AM – 6:00 PM", cutoff: "5:40 PM" },
  night: { label: "Night Shift", time: "6:00 PM – 6:00 AM", cutoff: "5:40 AM" },
};

export function OpenShiftForm({ suggested }: { suggested: string }) {
  const router = useRouter();
  const [arNo, setArNo]         = useState(suggested);
  const [notes, setNotes]       = useState("");
  const [shiftType, setShiftType] = useState<'day' | 'night'>(detectShiftType());
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await openShift(arNo, notes, shiftType);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  }

  const info = SHIFT_LABELS[shiftType];

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Shift type selector */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-stone-500">Shift Type</label>
        <div className="flex gap-2">
          {(["day", "night"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setShiftType(t)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                shiftType === t
                  ? t === "day"
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-indigo-500 bg-indigo-50 text-indigo-800"
                  : "border-stone-300 text-stone-500 hover:border-stone-400"
              }`}
            >
              {SHIFT_LABELS[t].label}
              <span className="ml-1 text-[10px] font-normal opacity-70">{SHIFT_LABELS[t].time}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-stone-400">
          Collection cutoff: <strong>{info.cutoff}</strong> — stop taking collections 20 min before shift ends.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-stone-500">Beginning AR Number</label>
        <input value={arNo} onChange={(e) => setArNo(e.target.value)} className={cls} placeholder="AR-000001" required />
        <p className="mt-1 text-[11px] text-stone-400">Enter the first AR number you will use this shift.</p>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-stone-500">Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} placeholder="e.g. Shift handover from AM cashier" />
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <button type="submit" disabled={busy}
        className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {busy ? "Opening…" : `Open ${info.label}`}
      </button>
    </form>
  );
}
