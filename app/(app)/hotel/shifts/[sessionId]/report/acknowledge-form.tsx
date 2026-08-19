"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeShiftReport } from "../../actions";

export function AcknowledgeForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await acknowledgeShiftReport(reportId, notes);
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setErr(res.error);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Remarks (optional — e.g. cash counted and received)"
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
      <button
        onClick={submit}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? "Acknowledging…" : "Acknowledge & receive report"}
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
