"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitDiscrepancyReason } from "../../actions";

export function DiscrepancyReasonForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        ✓ Discrepancy reason submitted. Hotel &amp; Rental Monitoring has been notified.
      </div>
    );
  }

  function submit() {
    setErr("");
    startTransition(async () => {
      const res = await submitDiscrepancyReason(reportId, reason);
      if (!res.ok) { setErr(res.error); return; }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-rose-800">
        A discrepancy was found between the system-expected collection and the actual payments recorded.
        Please explain the reason before this report can be reviewed by monitoring.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g. Guest paid extension in cash but I forgot to issue an AR; guest checked out late but I had already logged the payment at the base rate…"
        className="w-full rounded-lg border border-rose-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
      />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !reason.trim()}
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit discrepancy reason"}
      </button>
    </div>
  );
}
