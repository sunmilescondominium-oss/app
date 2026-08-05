"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reorderRoles } from "@/app/(app)/users/actions";

type Role = { key: string; label: string };

/** Reorder staff roles (drag or ▲▼) — sets the attendance-kiosk card order and
 *  role-list order. Owner/CEO at top shows first on the board. */
export function RoleOrder({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [order, setOrder] = useState<Role[]>(roles);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = order.map((r) => r.key).join() !== roles.map((r) => r.key).join();

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((o) => {
      const a = [...o];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return a;
    });
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    const res = await reorderRoles(order.map((r) => r.key));
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-800">Attendance board / role order</h2>
        {dirty && (
          <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
            {busy ? "Saving…" : "Save order"}
          </button>
        )}
        {!dirty && saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
      </div>
      <p className="mb-3 text-xs text-stone-500">Drag (or use ▲▼) to set the order. Employees appear on the attendance kiosk ranked by their highest role here — put Owner/CEO at the top.</p>
      <ol className="space-y-1">
        {order.map((r, i) => (
          <li
            key={r.key}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag != null) move(drag, i); setDrag(null); }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${drag === i ? "border-amber-300 bg-amber-50" : "border-stone-200"}`}
          >
            <span className="w-5 text-right text-xs text-stone-400 tabular-nums">{i + 1}</span>
            <span className="cursor-grab select-none text-stone-300" title="Drag">⠿</span>
            <span className="flex-1 text-stone-700">{r.label}</span>
            <span className="flex flex-col leading-none">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="text-[10px] text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label="Move up">▲</button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} className="text-[10px] text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label="Move down">▼</button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
