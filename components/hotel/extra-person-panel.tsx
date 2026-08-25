"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addExtraPersonCharge, removeExtraPersonCharge } from "@/app/(app)/hotel/actions";
import { peso } from "@/lib/collections/summary";
import type { StayOrder } from "@/lib/hotel/types";

export function ExtraPersonPanel({
  stayId,
  charges,
  extraPersonRate,
  canManage,
}: {
  stayId: string;
  charges: StayOrder[];       // orders where menu_item_id === null
  extraPersonRate: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function add() {
    setErr("");
    start(async () => {
      const res = await addExtraPersonCharge(stayId, count, note);
      if (!res.ok) { setErr(res.error); return; }
      setCount(1);
      setNote("");
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await removeExtraPersonCharge(id, stayId);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="no-print rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-semibold text-amber-900">Extra person charges</p>

      {charges.length === 0 ? (
        <p className="text-sm text-amber-700/60">No extra person charges yet.</p>
      ) : (
        <ul className="mb-3 space-y-1 text-sm">
          {charges.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="text-stone-700">
                {c.qty} × {c.name}
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums font-medium">{peso(c.qty * c.unit_price)}</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="space-y-2 border-t border-amber-200 pt-3">
          {extraPersonRate > 0 ? (
            <>
              <p className="text-xs text-amber-800">
                Rate: <strong>{peso(extraPersonRate)}</strong> per person
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-stone-600">Persons</label>
                  <input
                    type="number"
                    min={1}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="mb-1 block text-[11px] font-medium text-stone-600">Note (optional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. late arrival, extra adult"
                    className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={add}
                  disabled={pending}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {pending ? "Adding…" : "Add charge"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-rose-700">
              Extra person rate not configured — ask admin to set it in Hotel Settings.
            </p>
          )}
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
