"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openShift } from "./actions";

const cls = "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 w-full";

export function OpenShiftForm({ suggested }: { suggested: string }) {
  const router = useRouter();
  const [arNo, setArNo]   = useState(suggested);
  const [notes, setNotes] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await openShift(arNo, notes);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
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
        {busy ? "Opening…" : "Open Shift"}
      </button>
    </form>
  );
}
