"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AirbnbExtra } from "@/lib/airbnb/queries";
import { saveAirbnbExtra, toggleAirbnbExtra, deleteAirbnbExtra } from "./actions";

const CATEGORIES = ["Food","Parking","Amenity","Laundry","Other"];
const cls = "rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function ExtraRow({ e, canWrite }: { e: AirbnbExtra; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(e.name);
  const [category, setCategory] = useState(e.category);
  const [price, setPrice] = useState(e.unitPrice);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await saveAirbnbExtra(e.id, name, category, price, e.sortOrder);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setEditing(false); router.refresh();
  }

  if (editing) return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div><label className="text-[10px] text-stone-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${cls} w-full`} /></div>
        <div><label className="text-[10px] text-stone-500">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${cls} w-full`}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select></div>
        <div><label className="text-[10px] text-stone-500">Price (₱)</label>
          <input type="number" min="0" value={price} onChange={(ev) => setPrice(Number(ev.target.value))} className={`${cls} w-full`} /></div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? "…" : "Save"}</button>
        <button onClick={() => setEditing(false)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 py-2 last:border-0">
      <div>
        <span className={`text-sm font-medium ${e.isActive ? "text-stone-800" : "text-stone-400 line-through"}`}>{e.name}</span>
        <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">{e.category}</span>
        <span className="ml-2 text-xs text-stone-500">₱{e.unitPrice.toLocaleString("en-PH")}</span>
      </div>
      {canWrite && (
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setEditing(true)} className="text-xs text-amber-700 hover:underline">Edit</button>
          <button onClick={async () => { setBusy(true); await toggleAirbnbExtra(e.id, !e.isActive); router.refresh(); }}
            className="text-xs text-stone-500 hover:underline">{e.isActive ? "Disable" : "Enable"}</button>
          <button onClick={async () => { if (!confirm("Delete?")) return; await deleteAirbnbExtra(e.id); router.refresh(); }}
            className="text-xs text-rose-600 hover:underline">Delete</button>
        </div>
      )}
    </div>
  );
}

export function ExtrasPanel({ extras, canWrite }: { extras: AirbnbExtra[]; canWrite: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""); const [category, setCategory] = useState("Food");
  const [price, setPrice] = useState(0); const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    const res = await saveAirbnbExtra(null, name, category, price, 100);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setAdding(false); setName(""); setPrice(0); router.refresh();
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = extras.filter((e) => e.category === cat);
    return acc;
  }, {} as Record<string, AirbnbExtra[]>);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-800">AirBnB Extras / Menu</p>
          <p className="text-xs text-stone-400">Food, parking, amenities — guests can order from their QR portal.</p>
        </div>
        {canWrite && !adding && (
          <button onClick={() => setAdding(true)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">+ Add item</button>
        )}
      </div>
      {adding && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[10px] text-stone-500">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${cls} w-full`} placeholder="Breakfast plate" /></div>
            <div><label className="text-[10px] text-stone-500">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${cls} w-full`}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select></div>
            <div><label className="text-[10px] text-stone-500">Price (₱)</label>
              <input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`${cls} w-full`} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? "…" : "Add"}</button>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600">Cancel</button>
          </div>
        </div>
      )}
      {extras.length === 0 ? (
        <p className="text-xs text-stone-400">No extras yet.</p>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.filter((c) => grouped[c]?.length).map((cat) => (
            <div key={cat}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{cat}</p>
              {grouped[cat].map((e) => <ExtraRow key={e.id} e={e} canWrite={canWrite} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
