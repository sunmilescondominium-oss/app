"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addStayOrder, removeStayOrder } from "@/app/(app)/hotel/actions";
import { peso } from "@/lib/collections/summary";
import type { MenuItem, StayOrder } from "@/lib/hotel/types";

export function OrdersPanel({
  stayId,
  orders,
  menu,
  canWrite,
}: {
  stayId: string;
  orders: StayOrder[];
  menu: MenuItem[];
  canWrite: boolean;
}) {
  // Extra person charges (menu_item_id === null) are handled by ExtraPersonPanel
  orders = orders.filter((o) => o.menu_item_id !== null);
  const router = useRouter();
  const [itemId, setItemId] = useState(menu[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!itemId) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("menu_item_id", itemId);
    fd.append("qty", String(qty));
    const r = await addStayOrder(stayId, fd);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    setQty(1);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const r = await removeStayOrder(id, stayId);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="no-print rounded-2xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-stone-700">Room orders</p>

      {orders.length === 0 ? (
        <p className="text-sm text-stone-400">No orders yet.</p>
      ) : (
        <ul className="mb-3 space-y-1 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between">
              <span>
                {o.qty} × {o.name}
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums">{peso(o.qty * o.unit_price)}</span>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => remove(o.id)}
                    disabled={busy}
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

      {canWrite && menu.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
          >
            {menu.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {peso(m.price)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
            className="w-16 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Add order
          </button>
        </div>
      )}
    </div>
  );
}
