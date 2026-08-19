"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditARForm } from "./edit-ar-form";
import type { ARRegisterEntry } from "@/lib/hotel/ar-register";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", gcash: "GCash", maya: "Maya", bank_transfer: "Bank",
};

export function ARRegisterTable({
  entries,
  canEdit,
}: {
  entries: ARRegisterEntry[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  function done() { setEditing(null); router.refresh(); }

  if (!entries.length) {
    return <p className="py-8 text-center text-sm text-stone-400">No payments recorded for this date.</p>;
  }

  const total = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-400">
            <th className="pb-2 pr-3 font-medium">Time</th>
            <th className="pb-2 pr-3 font-medium">Room</th>
            <th className="pb-2 pr-3 font-medium">Guest</th>
            <th className="pb-2 pr-3 font-medium">Method</th>
            <th className="pb-2 pr-3 font-medium text-right">Amount</th>
            <th className="pb-2 pr-3 font-medium">AR No</th>
            <th className="pb-2 pr-3 font-medium">OR No</th>
            <th className="pb-2 font-medium">Note</th>
            {canEdit && <th className="pb-2 font-medium"></th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <>
              <tr key={e.paymentId} className={`border-b border-stone-50 ${e.voidedAsTest ? "opacity-50" : ""}`}>
                <td className="py-2 pr-3 text-stone-500">{fmt(e.paidAt)}</td>
                <td className="py-2 pr-3 font-medium text-stone-800">{e.unitNumber ?? "—"}</td>
                <td className="py-2 pr-3 text-stone-700">{e.guestLabel}</td>
                <td className="py-2 pr-3 text-stone-500">{METHOD_LABEL[e.method] ?? e.method}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-semibold">{peso(e.amount)}</td>
                <td className="py-2 pr-3 font-mono text-stone-700">{e.arNo ?? <span className="text-rose-400">—</span>}</td>
                <td className="py-2 pr-3 font-mono text-stone-500">{e.orNo ?? "—"}</td>
                <td className="py-2 pr-3">
                  {e.voidedAsTest && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] text-stone-500">TEST</span>}
                  {e.edits.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Edited ×{e.edits.length}</span>}
                </td>
                {canEdit && (
                  <td className="py-2">
                    <button
                      onClick={() => setEditing(editing === e.paymentId ? null : e.paymentId)}
                      className="rounded bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-amber-100 hover:text-amber-700"
                    >
                      {editing === e.paymentId ? "Cancel" : "Edit"}
                    </button>
                  </td>
                )}
              </tr>
              {editing === e.paymentId && (
                <tr key={`${e.paymentId}-edit`}>
                  <td colSpan={canEdit ? 9 : 8} className="pb-3 pl-2 pr-2">
                    <EditARForm
                      paymentId={e.paymentId}
                      currentArNo={e.arNo}
                      currentOrNo={e.orNo}
                      onDone={done}
                    />
                    {e.edits.length > 0 && (
                      <div className="mt-2 rounded-lg border border-stone-100 bg-stone-50 p-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase text-stone-400">Correction history</p>
                        {e.edits.map((ed, i) => (
                          <p key={i} className="text-[10px] text-stone-500">
                            {new Date(ed.editedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "short", timeStyle: "short" })}
                            {" · AR: "}{ed.oldArNo ?? "—"} → {ed.newArNo ?? "—"}
                            {ed.oldOrNo !== ed.newOrNo && <>{" · OR: "}{ed.oldOrNo ?? "—"} → {ed.newOrNo ?? "—"}</>}
                            {" · "}{ed.reason}
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-stone-200">
            <td colSpan={4} className="pt-2 text-xs font-semibold text-stone-500">Total collected</td>
            <td className="pt-2 text-right text-xs font-bold tabular-nums text-stone-800">{peso(total)}</td>
            <td colSpan={canEdit ? 4 : 3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
