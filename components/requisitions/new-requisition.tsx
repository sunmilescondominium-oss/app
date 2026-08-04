"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRequisition } from "@/app/(app)/requisitions/actions";
import type { MaterialItem } from "@/lib/requisitions/queries";

type Line = {
  itemId: string | null; itemName: string; category: string; unitLabel: string;
  qty: number; estUnitCost: number; target: "room_supplies" | "materials";
};

const BLANK: Line = { itemId: null, itemName: "", category: "consumable", unitLabel: "pc", qty: 1, estUnitCost: 0, target: "materials" };

export function NewRequisition({ catalog }: { catalog: MaterialItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [businessLine, setBusinessLine] = useState("");
  const [purpose, setPurpose] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const total = lines.reduce((s, l) => s + l.qty * l.estUnitCost, 0);

  function setLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function pickCatalog(idx: number, id: string) {
    if (!id) { setLine(idx, { itemId: null }); return; }
    const m = catalog.find((c) => c.id === id);
    if (m) setLine(idx, { itemId: m.id, itemName: m.name, category: m.category, unitLabel: m.unitLabel, target: m.target });
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    const res = await createRequisition({ title, businessLine, purpose, neededBy, note, items: lines });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setOpen(false);
    setTitle(""); setBusinessLine(""); setPurpose(""); setNeededBy(""); setNote(""); setLines([{ ...BLANK }]);
    if (res.id) router.push(`/requisitions/${res.id}`);
    else router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
        + New requisition
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-stone-800">New requisition</h3>
        <button onClick={() => setOpen(false)} className="text-sm text-stone-400 hover:text-stone-600">Cancel</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-stone-600">Title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Housekeeping supplies restock" className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-stone-600">Business line / area</span>
          <input value={businessLine} onChange={(e) => setBusinessLine(e.target.value)} placeholder="hotel · rentals · maintenance…" className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-stone-600">Purpose</span>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-stone-600">Needed by</span>
          <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">Items</span>
          <button onClick={() => setLines((ls) => [...ls, { ...BLANK }])} className="text-sm text-amber-700 hover:underline">+ Add item</button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-stone-200 p-2 sm:grid-cols-12">
              <select value={l.itemId ?? ""} onChange={(e) => pickCatalog(i, e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm sm:col-span-3">
                <option value="">Free-text…</option>
                {catalog.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.stockQty} {c.unitLabel})</option>)}
              </select>
              <input value={l.itemName} onChange={(e) => setLine(i, { itemName: e.target.value, itemId: null })} placeholder="Item name" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm sm:col-span-3" />
              <input type="number" min={0} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} placeholder="Qty" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm sm:col-span-1" />
              <input value={l.unitLabel} onChange={(e) => setLine(i, { unitLabel: e.target.value })} placeholder="unit" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm sm:col-span-1" />
              <input type="number" min={0} value={l.estUnitCost} onChange={(e) => setLine(i, { estUnitCost: Number(e.target.value) })} placeholder="Est. cost" className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm sm:col-span-2" />
              <select value={l.target} onChange={(e) => setLine(i, { target: e.target.value as Line["target"] })} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm sm:col-span-2">
                <option value="materials">→ Materials/tools</option>
                <option value="room_supplies">→ Housekeeping</option>
              </select>
              {lines.length > 1 && (
                <button onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))} className="text-xs text-red-500 hover:underline sm:col-span-12 sm:text-right">Remove</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-stone-600">Note</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
      </label>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-stone-500">Estimated total: <strong className="tabular-nums">₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></span>
        <button onClick={submit} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
          {busy ? "Saving…" : "Submit requisition"}
        </button>
      </div>
    </div>
  );
}
