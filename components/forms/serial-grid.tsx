"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSerialStatus } from "@/app/(app)/forms/actions";
import { SERIAL_STATUSES, SERIAL_TONE, type SerialRow, type SerialStatus } from "@/lib/forms/types";
import { peso } from "@/lib/collections/summary";

export function SerialGrid({ serials, canWrite }: { serials: SerialRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ status: SerialStatus; issuedTo: string; reference: string; amount: string; remarks: string }>({ status: "used", issuedTo: "", reference: "", amount: "", remarks: "" });

  function startEdit(s: SerialRow) {
    setEditId(s.id);
    setDraft({ status: s.status === "unused" ? "used" : s.status, issuedTo: s.issuedTo ?? "", reference: s.reference ?? "", amount: s.amount != null ? String(s.amount) : "", remarks: s.remarks ?? "" });
  }
  async function save(id: string) {
    setBusy(true);
    const res = await setSerialStatus(id, draft.status, { issuedTo: draft.issuedTo, reference: draft.reference, amount: draft.amount ? Number(draft.amount) : undefined, remarks: draft.remarks });
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setEditId(null);
    router.refresh();
  }

  const inp = "rounded-lg border border-stone-300 px-2 py-1 text-sm";
  return (
    <div className="table-wrap">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-3 py-2">Serial</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Issued to</th>
            <th className="px-3 py-2">Reference</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">By</th>
            {canWrite && <th className="no-print px-3 py-2 text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {serials.map((s) => (
            editId === s.id ? (
              <tr key={s.id} className="border-b border-amber-200 bg-amber-50/60 align-top">
                <td className="px-3 py-2 font-mono font-medium text-stone-800">{s.label}</td>
                <td className="px-3 py-2">
                  <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as SerialStatus }))} className={inp}>
                    {SERIAL_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input value={draft.issuedTo} onChange={(e) => setDraft((d) => ({ ...d, issuedTo: e.target.value }))} placeholder="payee / purpose" className={inp} /></td>
                <td className="px-3 py-2"><input value={draft.reference} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} placeholder="txn ref" className={inp} /></td>
                <td className="px-3 py-2 text-right"><input type="number" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} className={`${inp} w-24 text-right`} /></td>
                <td className="px-3 py-2" colSpan={2}>
                  <div className="flex items-center gap-2">
                    <input value={draft.remarks} onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))} placeholder="remarks" className={`${inp} flex-1`} />
                    <button type="button" onClick={() => save(s.id)} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditId(null)} className="text-xs text-stone-500 hover:underline">Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={s.id} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2 font-mono font-medium text-stone-800">{s.label}</td>
                <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${SERIAL_TONE[s.status]}`}>{s.status}</span></td>
                <td className="px-3 py-2 text-stone-600">{s.issuedTo ?? "—"}</td>
                <td className="px-3 py-2 text-stone-500">{s.reference ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.amount != null ? peso(s.amount) : "—"}</td>
                <td className="px-3 py-2 text-xs text-stone-500">{s.usedByRole?.replace(/_/g, " ") ?? "—"}</td>
                {canWrite && <td className="no-print px-3 py-2 text-right"><button type="button" onClick={() => startEdit(s)} className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">Mark…</button></td>}
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}
