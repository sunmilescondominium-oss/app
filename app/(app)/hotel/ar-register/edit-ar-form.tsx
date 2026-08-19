"use client";

import { useState } from "react";
import { adjustPaymentAR } from "@/app/(app)/hotel/actions";

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function EditARForm({
  paymentId,
  currentArNo,
  currentOrNo,
  onDone,
}: {
  paymentId: string;
  currentArNo: string | null;
  currentOrNo: string | null;
  onDone: () => void;
}) {
  const [arNo, setArNo]   = useState(currentArNo ?? "");
  const [orNo, setOrNo]   = useState(currentOrNo ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");

  async function submit() {
    if (!reason.trim()) { setErr("Reason is required."); return; }
    setBusy(true); setErr("");
    const r = await adjustPaymentAR(paymentId, arNo, orNo, reason);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    onDone();
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">AR No</label>
          <input value={arNo} onChange={(e) => setArNo(e.target.value)} className={inputCls} placeholder="e.g. AR-002384" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">OR No</label>
          <input value={orNo} onChange={(e) => setOrNo(e.target.value)} className={inputCls} placeholder="e.g. OR-000123" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Reason *</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="Correction reason" />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {busy ? "Saving…" : "Save correction"}
        </button>
        <button onClick={onDone}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100">
          Cancel
        </button>
      </div>
    </div>
  );
}
