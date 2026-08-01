"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { CollectionForm } from "./collection-form";
import { deleteCollection } from "@/app/(app)/collections/actions";
import { peso } from "@/lib/collections/summary";
import { COLLECTION_CATEGORIES, PAYMENT_TYPES } from "@/lib/config";
import type { Collection, UnitOption } from "@/lib/collections/types";

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  COLLECTION_CATEGORIES.map((c) => [c.key, c.label]),
);
const PAY_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_TYPES.map((p) => [p.key, p.label]),
);

function roleLabel(rk: string | null): string {
  if (!rk) return "—";
  return rk.charAt(0).toUpperCase() + rk.slice(1).replace(/_/g, " ");
}

export function CollectionsPanel({
  collections,
  unitOptions,
  canWrite,
  date,
}: {
  collections: Collection[];
  unitOptions: UnitOption[];
  canWrite: boolean;
  date: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const done = () => {
    setOpen(false);
    router.refresh();
  };

  async function remove(c: Collection) {
    if (!window.confirm(`Delete this ${peso(c.amount)} entry?`)) return;
    setPendingId(c.id);
    const res = await deleteCollection(c.id);
    setPendingId(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap gap-2">
        {canWrite && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            + Add collection
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Print report
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">OR #</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Collected by</th>
              <th className="px-4 py-3 text-right">Amount</th>
              {canWrite && <th className="no-print px-4 py-3 text-right">·</th>}
            </tr>
          </thead>
          <tbody>
            {collections.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 7 : 6} className="px-4 py-10 text-center text-slate-500">
                  No collections recorded for {date}.
                </td>
              </tr>
            )}
            {collections.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{c.or_number ?? "—"}</td>
                <td className="px-4 py-3">{CAT_LABEL[c.business_line] ?? c.business_line}</td>
                <td className="px-4 py-3">{c.unit?.unit_number ?? "—"}</td>
                <td className="px-4 py-3">{PAY_LABEL[c.payment_type] ?? c.payment_type}</td>
                <td className="px-4 py-3">{roleLabel(c.collected_by_role)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{peso(c.amount)}</td>
                {canWrite && (
                  <td className="no-print px-4 py-3 text-right">
                    {c.transmittal_id ? (
                      <span className="text-[10px] font-semibold uppercase text-slate-400">
                        transmitted
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        disabled={pendingId === c.id}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Add collection — ${date}`}>
        <CollectionForm date={date} unitOptions={unitOptions} onDone={done} />
      </Modal>
    </div>
  );
}
