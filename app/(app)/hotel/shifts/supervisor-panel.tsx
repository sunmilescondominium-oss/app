"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelShift } from "./actions";

export function SupervisorPanel({
  sessionId,
  cashierName,
  isOnDuty,
}: {
  sessionId: string;
  cashierName: string;
  isOnDuty: boolean;
}) {
  const router = useRouter();
  const [showVoid, setShowVoid] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function voidShift() {
    if (!reason.trim()) { setErr("Reason is required."); return; }
    if (!window.confirm(`Void/cancel ${cashierName}'s shift? This cannot be undone.`)) return;
    setBusy(true); setErr("");
    const res = await cancelShift(sessionId, reason);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <p className="mb-1 text-sm font-semibold text-rose-900">Supervisor Override</p>
      <p className="mb-3 text-xs text-rose-700">
        {isOnDuty
          ? "You can end your own shift using the End Shift form above, or void it below."
          : `You can end ${cashierName}'s shift using End Shift above, or void it entirely below.`}
      </p>

      {!showVoid ? (
        <button
          onClick={() => setShowVoid(true)}
          className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
        >
          Void / cancel this shift
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-rose-800">
            Voiding cancels the shift with no collection report (use for shifts opened by mistake).
            For a normal end-of-shift with a report, use <strong>End Shift</strong> above.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason for voiding (e.g. wrong cashier opened shift, system test)"
            className="w-full rounded-lg border border-rose-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={voidShift}
              disabled={busy}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {busy ? "Voiding…" : "Confirm void shift"}
            </button>
            <button
              onClick={() => { setShowVoid(false); setErr(""); setReason(""); }}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
