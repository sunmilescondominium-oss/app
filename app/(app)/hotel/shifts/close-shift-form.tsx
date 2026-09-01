"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeShift } from "./actions";

const cls = "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 w-full";

export function CloseShiftForm({
  sessionId,
  activeStayCount = 0,
  bagDone = false,
}: {
  sessionId: string;
  activeStayCount?: number;
  bagDone?: boolean;
}) {
  const router = useRouter();
  const [arNo, setArNo]   = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");
  const [confirm, setConfirm] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [ackSkip, setAckSkip]       = useState(false);

  const needsSkipAck = !bagDone && !ackSkip;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm) { setConfirm(true); return; }
    setBusy(true); setErr("");
    const combinedNotes = [
      notes.trim(),
      !bagDone && skipReason.trim() ? `Bag skipped — ${skipReason.trim()}` : "",
    ].filter(Boolean).join(" | ");
    const res = await closeShift(sessionId, arNo, combinedNotes);
    setBusy(false);
    if (!res.ok) { setErr(res.error); setConfirm(false); return; }
    if (res.reportId) {
      router.push(`/hotel/shifts/${sessionId}/report`);
    } else {
      router.refresh();
    }
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

      {/* Bag-not-done warning */}
      {!bagDone && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-900">⚠ You have not completed Count &amp; Bagging</p>
          <p className="text-[11px] text-amber-800">
            Hotel &amp; Rental Monitoring will need to count your cash manually. This will be flagged for performance evaluation.
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-amber-800">
              Reason for skipping (required to proceed)
            </label>
            <input
              value={skipReason}
              onChange={(e) => { setSkipReason(e.target.value); setAckSkip(false); }}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-amber-500"
              placeholder="e.g. Emergency handover, no time to count"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ackSkip}
              onChange={(e) => setAckSkip(e.target.checked)}
              className="mt-0.5 accent-amber-600"
            />
            <span className="text-[11px] text-amber-800">
              I understand this will be flagged and monitoring will count manually.
            </span>
          </label>
        </div>
      )}

      {err && <p className="text-xs text-rose-600">{err}</p>}
      {activeStayCount > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <strong>{activeStayCount} room{activeStayCount > 1 ? "s" : ""} still checked in.</strong>{" "}
          Your shift will close and these stays remain active. The next cashier will handle any new payments or checkout — those will appear in their shift report, not yours.
        </div>
      )}
      {confirm && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 font-medium">
          Confirm: closing shift with ending AR <strong>{arNo}</strong>. This will release the hotel ops lock.
        </p>
      )}
      <button
        type="submit"
        disabled={busy || (needsSkipAck) || (!bagDone && !skipReason.trim())}
        className={`w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60 ${
          confirm ? "bg-rose-600 hover:bg-rose-700" : "bg-stone-700 hover:bg-stone-800"
        }`}
      >
        {busy ? "Closing…" : confirm ? "Confirm End Shift" : "End Shift"}
      </button>
    </form>
  );
}
