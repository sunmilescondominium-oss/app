"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePayable, releasePayable, cancelPayable } from "@/app/(app)/payables/actions";
import { PAYABLE_TYPES, PAYABLE_STATUS_TONE, type Payable } from "@/lib/payables/types";
import { Badge } from "@/components/ui";
import { peso } from "@/lib/collections/summary";

const TYPE_LABEL = Object.fromEntries(PAYABLE_TYPES.map((t) => [t.key, t.label]));

export function PayablesTable({ payables, canApprove, canRelease }: { payables: Payable[]; canApprove: boolean; canRelease: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (!res.ok) { window.alert(res.error); return; }
    router.refresh();
  }
  async function release(id: string) {
    const orNo = window.prompt("Release voucher / OR no. (optional):") ?? "";
    const method = window.prompt("Method (cash / check / gcash / bank):") ?? "";
    await act(id, () => releasePayable(id, orNo, method));
  }

  return (
    <div className="table-wrap">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">Payee</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="no-print px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {payables.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">No payables.</td></tr>}
          {payables.map((p) => (
            <tr key={p.id} className="border-b border-stone-100 align-top last:border-0">
              <td className="px-4 py-2.5 font-medium text-stone-800">{p.payeeName}<span className="block text-[11px] text-stone-400">{p.payeeKind}</span></td>
              <td className="px-4 py-2.5">{TYPE_LABEL[p.ptype] ?? p.ptype}{p.parentPayableId && <span className="block text-[11px] text-stone-400">↳ override</span>}</td>
              <td className="px-4 py-2.5 text-stone-600">{p.description ?? "—"}{p.refNo && <span className="block text-[11px] text-stone-400">ref {p.refNo}</span>}</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{peso(p.amount)}</td>
              <td className="px-4 py-2.5"><Badge tone={PAYABLE_STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>{p.releaseOrNo && <span className="block text-[11px] text-stone-400">{p.releaseMethod} · {p.releaseOrNo}</span>}</td>
              <td className="no-print px-4 py-2.5 text-right">
                <div className="flex justify-end gap-1.5">
                  {p.status === "pending" && canApprove && <button type="button" onClick={() => act(p.id, () => approvePayable(p.id))} disabled={busy === p.id} className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Approve</button>}
                  {p.status === "approved" && canRelease && <button type="button" onClick={() => release(p.id)} disabled={busy === p.id} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Release</button>}
                  {(p.status === "pending" || p.status === "approved") && canApprove && <button type="button" onClick={() => act(p.id, () => cancelPayable(p.id))} disabled={busy === p.id} className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50">Cancel</button>}
                  {p.status === "released" && <span className="text-xs text-stone-400">released</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
