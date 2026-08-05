"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkDeleteIncidents } from "@/app/(app)/incidents/actions";

type Item = { id: string; title: string; category: string; createdAt: string };

export function IncidentBulkDelete({ items }: { items: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => (items.every((i) => s.has(i.id)) ? new Set() : new Set(items.map((i) => i.id))));

  async function del() {
    if (!window.confirm(`Delete ${selected.size} incident(s)? This cannot be undone.`)) return;
    setBusy(true);
    const res = await bulkDeleteIncidents([...selected]);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setSelected(new Set());
    router.refresh();
  }

  if (items.length === 0) return null;

  return (
    <div className="no-print mb-4 rounded-2xl border border-stone-200 bg-stone-50/60 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Bulk delete incidents</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-amber-700 hover:underline">{open ? "Close" : "Open cleanup"}</button>
      </div>
      {open && (
        <div className="mt-2">
          <div className="mb-2 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-stone-600"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-amber-600" />Select all</label>
            {selected.size > 0 && <button type="button" onClick={del} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Delete {selected.size}</button>}
          </div>
          <ul className="max-h-56 space-y-1 overflow-auto">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 accent-amber-600" />
                <span className="text-stone-700">{i.title}</span>
                <span className="text-xs text-stone-400">· {i.category} · {new Date(i.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
