"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reassignCustodian } from "@/app/(app)/forms/actions";
import type { CustodyEntry } from "@/lib/forms/types";

type Custodian = { userId: string; label: string; role: string | null };

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CustodyPanel({ bookletId, custodians, custody, canManage }: { bookletId: string; custodians: Custodian[]; custody: CustodyEntry[]; canManage: boolean }) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const c = custodians.find((x) => x.userId === to);
    if (!c) return;
    setBusy(true);
    const res = await reassignCustodian(bookletId, to, c.role ?? "", note);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setTo(""); setNote("");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className="mb-2 font-semibold text-stone-800">Custody</h3>
      {canManage && (
        <div className="no-print mb-3 space-y-2">
          <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
            <option value="">Hand over to…</option>
            {custodians.map((c) => <option key={c.userId} value={c.userId}>{c.label}{c.role ? ` (${c.role.replace(/_/g, " ")})` : ""}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note" className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
          <button type="button" onClick={submit} disabled={busy || !to} className="w-full rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Reassign</button>
        </div>
      )}
      <ol className="space-y-1.5 text-sm">
        {custody.length === 0 && <li className="text-stone-400">No custody records yet.</li>}
        {custody.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-2 border-b border-stone-100 pb-1.5 last:border-0">
            <span className="text-stone-700">{c.fromLabel ?? "—"} → <strong>{c.toLabel ?? "—"}</strong></span>
            <span className="text-xs text-stone-400">{fmt(c.at)}{c.byLabel ? ` · by ${c.byLabel}` : ""}{c.note ? ` · ${c.note}` : ""}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
