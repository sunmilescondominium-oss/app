"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMenuItem, type ActionResult } from "@/app/(app)/hotel/actions";
import { HOTEL_MENU_CATEGORIES } from "@/lib/config";
import { peso } from "@/lib/collections/summary";
import type { MenuItem } from "@/lib/hotel/types";

const inputCls =
  "rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function MenuManager({ menu, onDone }: { menu: MenuItem[]; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(createMenuItem, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Menu items</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {menu.map((m) => (
          <li key={m.id} className="flex justify-between rounded-lg border border-stone-200 px-3 py-1.5">
            <span>
              <span className="text-stone-400">{m.category}</span> · {m.name}
            </span>
            <span className="tabular-nums text-stone-500">{peso(m.price)}</span>
          </li>
        ))}
      </ul>
      <form action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select name="category" defaultValue="Food" className={inputCls}>
          {HOTEL_MENU_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input name="name" placeholder="Item name" className={`${inputCls} col-span-2`} />
        <input name="price" type="number" step="0.01" placeholder="Price" className={inputCls} />
        <button type="submit" disabled={pending} className="col-span-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 sm:col-span-4">
          {pending ? "Adding…" : "Add menu item"}
        </button>
      </form>
      {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
    </div>
  );
}
