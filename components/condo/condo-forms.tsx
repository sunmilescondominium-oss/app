"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCondoDefaults, setPropertyRate, setUnitRateOverride, generateMonthlyDues } from "@/app/(app)/condo/actions";

const cls = "rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function CondoSettingsForm({ defaultRate, bankAccount, dueDay }: { defaultRate: number; bankAccount: string | null; dueDay: number }) {
  const router = useRouter();
  const [rate, setRate] = useState(defaultRate);
  const [bank, setBank] = useState(bankAccount ?? "");
  const [day, setDay] = useState(dueDay);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await setCondoDefaults(rate, bank, day);
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Default dues rate (₱/sqm)</label>
        <input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${cls} w-28`} />
      </div>
      <div className="min-w-[14rem] flex-1">
        <label className="mb-1 block text-xs font-medium text-stone-600">Common-area bank account</label>
        <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Bank / account no. for condo fund" className={`${cls} w-full`} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Due day</label>
        <input type="number" min="1" max="28" value={day} onChange={(e) => setDay(Number(e.target.value))} className={`${cls} w-16`} />
      </div>
      <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {busy ? "…" : "Save settings"}
      </button>
    </div>
  );
}

export function PropertyRates({ properties }: { properties: { id: string; name: string; rate: number }[] }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-stone-700">Rate per property (₱/sqm)</p>
      <div className="space-y-2">{properties.map((p) => <PropertyRateRow key={p.id} p={p} />)}</div>
      <p className="mt-2 text-[11px] text-stone-400">Blank / 0 falls back to the default rate; a per-unit override wins over both.</p>
    </div>
  );
}

function PropertyRateRow({ p }: { p: { id: string; name: string; rate: number } }) {
  const router = useRouter();
  const [rate, setRate] = useState(p.rate);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await setPropertyRate(p.id, rate);
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-[10rem] flex-1 text-stone-700">{p.name}</span>
      <input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${cls} w-24`} />
      <button type="button" onClick={save} disabled={busy || rate === p.rate} className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Save</button>
    </div>
  );
}

export function GenerateDues({ month }: { month: string }) {
  const router = useRouter();
  const [m, setM] = useState(month);
  const [busy, setBusy] = useState(false);
  async function gen() {
    if (!window.confirm(`Generate association dues for ${m}?`)) return;
    setBusy(true);
    const r = await generateMonthlyDues(m);
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Generate dues for month</label>
        <input type="month" value={m} onChange={(e) => setM(e.target.value)} className={cls} />
      </div>
      <button type="button" onClick={gen} disabled={busy} className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900 disabled:opacity-60">
        {busy ? "Generating…" : "Generate association dues"}
      </button>
      <span className="pb-2 text-xs text-stone-400">Area × rate per unit; skips units already billed for the month.</span>
    </div>
  );
}

export function UnitRateOverride({ unitId, value }: { unitId: string; value: number | null }) {
  const router = useRouter();
  const [v, setV] = useState(value == null ? "" : String(value));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await setUnitRateOverride(unitId, v);
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="—" className={`${cls} w-20`} title="Per-unit ₱/sqm override" />
      <button type="button" onClick={save} disabled={busy} className="text-xs text-amber-700 hover:underline disabled:opacity-50">set</button>
    </span>
  );
}
