"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeShift } from "./actions";

const cls = "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 w-full";

export function CloseShiftForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [arNo, setArNo]   = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");
  const [confirm, setConfirm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm) { setConfirm(true); return; }
    setBusy(true); setErr("");
    const res = await closeShift(sessionId, arNo, notes);
    setBusy(false);
    if (!res.ok) { setErr(res.error); setConfirm(false); return; }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-stone-500">Ending AR Number</label>
        <input value={arNo} onChange={(e) => { setArNo(e.target.value); setConfirm(false); }}
          className={cls} placeholder="AR-000045" required />
        <p className="mt-1 text-[11px] text-stone-400">Last AR number you issued this shift. The next cashier begins from the next number.</p>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-stone-500">Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} placeholder="e.g. Turnover remarks" />
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      {confirm && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 font-medium">
          Confirm: closing shift with ending AR <strong>{arNo}</strong>. This will release the hotel ops lock.
        </p>
      )}
      <button type="submit" disabled={busy}
        className={`w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60 ${
          confirm ? "bg-rose-600 hover:bg-rose-700" : "bg-stone-700 hover:bg-stone-800"
        }`}>
        {busy ? "Closing…" : confirm ? "Confirm Close Shift" : "Close Shift"}
      </button>
    </form>
  );
}
