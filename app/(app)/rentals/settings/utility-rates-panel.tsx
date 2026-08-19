"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UtilityRate } from "@/lib/airbnb/queries";
import { saveUtilityRate } from "./actions";

const cls = "rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function AddRateForm({ utility, onDone }: { utility: "electric" | "water"; onDone: () => void }) {
  const router = useRouter();
  const [ratePerUnit, setRatePerUnit] = useState(0);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveUtilityRate(utility, ratePerUnit, serviceCharge, effectiveFrom, notes);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    onDone(); router.refresh();
  }

  return (
    <form onSubmit={save} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="text-[10px] text-stone-500">Rate per {utility === "electric" ? "kWh" : "m³"} (₱)</label>
          <input type="number" min="0" step="0.0001" value={ratePerUnit}
            onChange={(e) => setRatePerUnit(Number(e.target.value))} required className={`${cls} w-full`} />
        </div>
        <div>
          <label className="text-[10px] text-stone-500">Service charge (₱/mo)</label>
          <input type="number" min="0" step="0.01" value={serviceCharge}
            onChange={(e) => setServiceCharge(Number(e.target.value))} className={`${cls} w-full`} />
        </div>
        <div>
          <label className="text-[10px] text-stone-500">Effective from</label>
          <input type="date" value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)} required className={`${cls} w-full`} />
        </div>
        <div>
          <label className="text-[10px] text-stone-500">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${cls} w-full`} placeholder="Optional" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          {busy ? "…" : "Add rate"}
        </button>
        <button type="button" onClick={onDone}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600">Cancel</button>
      </div>
    </form>
  );
}

function UtilitySection({ utility, rates, canWrite }: {
  utility: "electric" | "water"; rates: UtilityRate[]; canWrite: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const filtered = rates.filter((r) => r.utility === utility).slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-600 capitalize">{utility} {utility === "electric" ? "(per kWh)" : "(per m³)"}</p>
        {canWrite && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs text-amber-700 hover:underline">+ New rate</button>
        )}
      </div>
      {adding && <AddRateForm utility={utility} onDone={() => setAdding(false)} />}
      {filtered.length === 0 ? (
        <p className="mt-1 text-xs text-stone-400">No rates set yet.</p>
      ) : (
        <div className="mt-2 space-y-1">
          {filtered.map((r, i) => (
            <div key={r.id} className={`flex items-center gap-4 rounded px-2.5 py-1.5 text-xs ${i === 0 ? "bg-amber-50 font-semibold" : "bg-stone-50 text-stone-500"}`}>
              <span>{i === 0 ? "★ " : ""}{r.effectiveFrom}</span>
              <span>₱{r.ratePerUnit.toFixed(4)}/unit</span>
              {r.serviceCharge > 0 && <span>+ ₱{r.serviceCharge.toFixed(2)} service</span>}
              {r.notes && <span className="text-stone-400">{r.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UtilityRatesPanel({ rates, canWrite }: { rates: UtilityRate[]; canWrite: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-stone-800">Utility Rates</p>
      <p className="mb-3 text-xs text-stone-400">
        Rates used to compute electric and water bills from meter readings. The most recent rate on or before the billing date is applied. Historical rates are preserved.
      </p>
      <div className="space-y-4">
        <UtilitySection utility="electric" rates={rates} canWrite={canWrite} />
        <UtilitySection utility="water" rates={rates} canWrite={canWrite} />
      </div>
    </div>
  );
}
