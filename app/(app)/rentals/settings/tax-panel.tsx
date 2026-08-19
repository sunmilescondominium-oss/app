"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AirbnbTaxSettings } from "@/lib/airbnb/queries";
import { saveAirbnbTax, saveRentalTax } from "./actions";

const TAX_MODES = [
  { key: "none", label: "No tax" },
  { key: "vat", label: "VAT (12%)" },
  { key: "percentage", label: "Custom %" },
];
const cls = "rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function TaxRow({
  label, tax, canWrite, onSave,
}: { label: string; tax: AirbnbTaxSettings; canWrite: boolean; onSave: (mode: string, rate: number) => Promise<void> }) {
  const [mode, setMode] = useState(tax.taxMode);
  const [rate, setRate] = useState(tax.taxMode === "vat" ? 12 : tax.taxRate * 100);
  const [busy, setBusy] = useState(false);

  const effectiveRate = mode === "vat" ? 0.12 : mode === "percentage" ? rate / 100 : 0;

  async function save() {
    setBusy(true);
    await onSave(mode, effectiveRate);
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
      <p className="mb-2 text-xs font-semibold text-stone-700">{label}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[10px] text-stone-500">Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={!canWrite} className={cls}>
            {TAX_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        {mode === "percentage" && (
          <div>
            <label className="mb-1 block text-[10px] text-stone-500">Rate (%)</label>
            <input type="number" min="0" max="100" step="0.01" value={rate}
              onChange={(e) => setRate(Number(e.target.value))} disabled={!canWrite} className={`${cls} w-24`} />
          </div>
        )}
        <span className="pb-2 text-xs text-stone-400">
          {mode === "none" ? "No tax applied" : `${(effectiveRate * 100).toFixed(2)}% added to total`}
        </span>
        {canWrite && (
          <button onClick={save} disabled={busy}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {busy ? "…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

export function TaxPanel({ airbnbTax, rentalTax, canWrite }: {
  airbnbTax: AirbnbTaxSettings; rentalTax: AirbnbTaxSettings; canWrite: boolean;
}) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-stone-800">Tax Settings</p>
      <div className="space-y-3">
        <TaxRow label="AirBnB tax" tax={airbnbTax} canWrite={canWrite}
          onSave={async (m, r) => { await saveAirbnbTax(m, r); router.refresh(); }} />
        <TaxRow label="Rental tax" tax={rentalTax} canWrite={canWrite}
          onSave={async (m, r) => { await saveRentalTax(m, r); router.refresh(); }} />
      </div>
    </div>
  );
}
