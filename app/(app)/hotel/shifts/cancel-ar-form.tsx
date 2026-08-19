"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logCancelledAr } from "./actions";

const cls = "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 w-full";

export function CancelArForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [arNo, setArNo]     = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await logCancelledAr(sessionId, arNo, reason);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setArNo(""); setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-stone-500">Cancelled AR Number</label>
        <input value={arNo} onChange={(e) => setArNo(e.target.value)}
          className={cls} placeholder="AR-000023" required />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-stone-500">Reason <span className="text-rose-500">*</span></label>
        <input value={reason} onChange={(e) => setReason(e.target.value)}
          className={cls} placeholder="e.g. Wrong amount entered, spoiled, duplicate" required />
      </div>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <button type="submit" disabled={busy}
        className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
        {busy ? "Logging…" : "Log Cancelled AR"}
      </button>
    </form>
  );
}
