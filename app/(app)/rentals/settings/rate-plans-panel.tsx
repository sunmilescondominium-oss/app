"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AirbnbRatePlan } from "@/lib/airbnb/queries";
import { saveAirbnbRatePlan, toggleAirbnbRatePlan, deleteAirbnbRatePlan } from "./actions";

const RATE_TYPES = ["nightly","overnight","daily","2-night","3-night","weekly","monthly","custom"];
const cls = "rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function PlanRow({ p, canWrite }: { p: AirbnbRatePlan; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [rateType, setRateType] = useState(p.rateType);
  const [rate, setRate] = useState(p.rate);
  const [minNights, setMinNights] = useState(p.minNights);
  const [desc, setDesc] = useState(p.description ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await saveAirbnbRatePlan(p.id, name, rateType, rate, minNights, desc, p.sortOrder);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setEditing(false); router.refresh();
  }

  if (editing) return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><label className="text-[10px] text-stone-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${cls} w-full`} /></div>
        <div><label className="text-[10px] text-stone-500">Type</label>
          <select value={rateType} onChange={(e) => setRateType(e.target.value)} className={`${cls} w-full`}>
            {RATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <div><label className="text-[10px] text-stone-500">Rate (₱)</label>
          <input type="number" min="0" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${cls} w-full`} /></div>
        <div><label className="text-[10px] text-stone-500">Min nights</label>
          <input type="number" min="1" value={minNights} onChange={(e) => setMinNights(Number(e.target.value))} className={`${cls} w-full`} /></div>
      </div>
      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className={`${cls} w-full`} />
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{busy ? "…" : "Save"}</button>
        <button onClick={() => setEditing(false)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 py-2 last:border-0">
      <div className="min-w-0">
        <span className={`text-sm font-medium ${p.isActive ? "text-stone-800" : "text-stone-400 line-through"}`}>{p.name}</span>
        <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">{p.rateType}</span>
        <span className="ml-2 text-xs text-stone-500">₱{p.rate.toLocaleString("en-PH")} · {p.minNights}+ night{p.minNights !== 1 ? "s" : ""}</span>
        {p.description && <p className="text-[11px] text-stone-400">{p.description}</p>}
      </div>
      {canWrite && (
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setEditing(true)} className="text-xs text-amber-700 hover:underline">Edit</button>
          <button onClick={async () => { setBusy(true); await toggleAirbnbRatePlan(p.id, !p.isActive); router.refresh(); setBusy(false); }}
            className="text-xs text-stone-500 hover:underline">{p.isActive ? "Disable" : "Enable"}</button>
          <button onClick={async () => { if (!confirm("Delete this rate plan?")) return; setBusy(true); await deleteAirbnbRatePlan(p.id); router.refresh(); }}
            className="text-xs text-rose-600 hover:underline">Delete</button>
        </div>
      )}
    </div>
  );
}

export function RatePlansPanel({ plans, canWrite }: { plans: AirbnbRatePlan[]; canWrite: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""); const [rateType, setRateType] = useState("nightly");
  const [rate, setRate] = useState(0); const [minNights, setMinNights] = useState(1);
  const [desc, setDesc] = useState(""); const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    const res = await saveAirbnbRatePlan(null, name, rateType, rate, minNights, desc, 100);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setAdding(false); setName(""); setRate(0); setMinNights(1); setDesc("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">AirBnB Rate Plans</p>
        {canWrite && !adding && (
          <button onClick={() => setAdding(true)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">+ Add rate</button>
        )}
      </div>
      {adding && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><label className="text-[10px] text-stone-500">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${cls} w-full`} placeholder="Weekend rate" /></div>
            <div><label className="text-[10px] text-stone-500">Type</label>
              <select value={rateType} onChange={(e) => setRateType(e.target.value)} className={`${cls} w-full`}>
                {RATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className="text-[10px] text-stone-500">Rate (₱)</label>
              <input type="number" min="0" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${cls} w-full`} /></div>
            <div><label className="text-[10px] text-stone-500">Min nights</label>
              <input type="number" min="1" value={minNights} onChange={(e) => setMinNights(Number(e.target.value))} className={`${cls} w-full`} /></div>
          </div>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className={`${cls} w-full`} />
          <div className="flex gap-2">
            <button onClick={add} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? "…" : "Add"}</button>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600">Cancel</button>
          </div>
        </div>
      )}
      {plans.length === 0 ? (
        <p className="text-xs text-stone-400">No rate plans yet.</p>
      ) : (
        <div>{plans.map((p) => <PlanRow key={p.id} p={p} canWrite={canWrite} />)}</div>
      )}
    </div>
  );
}
