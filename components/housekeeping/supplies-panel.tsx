"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adjustStock, createSupply, setSupplyDefault, type ActionResult } from "@/app/(app)/housekeeping/actions";
import type { RoomSupply } from "@/lib/housekeeping/types";
import { t, type Lang } from "@/lib/i18n";

const inputCls =
  "rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function SuppliesPanel({
  supplies,
  canManage,
  canSetDefaults = false,
  lang = "en",
}: {
  supplies: RoomSupply[];
  canManage: boolean;
  canSetDefaults?: boolean;
  lang?: Lang;
}) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const [addState, addAction, addPending] = useActionState<ActionResult | undefined, FormData>(createSupply, undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [amt, setAmt] = useState<Record<string, string>>({});

  async function toggleDefault(id: string, next: boolean) {
    setBusy(id);
    const r = await setSupplyDefault(id, next);
    setBusy(null);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  useEffect(() => {
    if (addState?.ok) router.refresh();
  }, [addState, router]);

  async function restock(id: string, sign: 1 | -1) {
    const n = Number(amt[id] ?? "0") || 0;
    if (n <= 0) return;
    setBusy(id);
    const r = await adjustStock(id, sign * n);
    setBusy(null);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    setAmt((a) => ({ ...a, [id]: "" }));
    router.refresh();
  }

  return (
    <div className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Room supplies</h2>
      <div className="table-wrap">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Stock</th>
              {canSetDefaults && <th className="px-4 py-3 text-center">{tr("hk_col_default")}</th>}
              {canManage && <th className="px-4 py-3 text-right">Adjust</th>}
            </tr>
          </thead>
          <tbody>
            {supplies.map((s) => {
              const low = s.stock_qty <= s.reorder_level;
              return (
                <tr key={s.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.stock_qty} {s.unit_label}
                    {low && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">low</span>
                    )}
                  </td>
                  {canSetDefaults && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={s.is_default}
                        disabled={busy === s.id}
                        onChange={(e) => toggleDefault(s.id, e.target.checked)}
                        className="h-4 w-4 rounded border-stone-300"
                        aria-label={tr("hk_col_default")}
                      />
                    </td>
                  )}
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          value={amt[s.id] ?? ""}
                          onChange={(e) => setAmt((a) => ({ ...a, [s.id]: e.target.value }))}
                          placeholder="qty"
                          className={`${inputCls} w-16`}
                        />
                        <button type="button" onClick={() => restock(s.id, 1)} disabled={busy === s.id} className="rounded-lg border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100 disabled:opacity-50">
                          + add
                        </button>
                        <button type="button" onClick={() => restock(s.id, -1)} disabled={busy === s.id} className="rounded-lg border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100 disabled:opacity-50">
                          − use
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canSetDefaults && <p className="mt-2 text-xs text-stone-400">{tr("hk_default_hint")}</p>}

      {canManage && (
        <form action={addAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input name="name" placeholder="New supply name" className={inputCls} />
          <input name="unit_label" placeholder="unit (pcs)" defaultValue="pcs" className={`${inputCls} w-20`} />
          <input name="stock_qty" type="number" placeholder="stock" className={`${inputCls} w-24`} />
          <input name="reorder_level" type="number" placeholder="reorder" className={`${inputCls} w-24`} />
          <button type="submit" disabled={addPending} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            Add supply
          </button>
          {addState && !addState.ok && <p className="w-full text-sm text-red-700">{addState.error}</p>}
        </form>
      )}
    </div>
  );
}
