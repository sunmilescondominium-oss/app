"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setFinanceVat } from "@/app/(app)/finance/actions";
import { TAX_MODES } from "@/lib/config";
import type { FinanceSettings } from "@/lib/finance/types";

const inputCls =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function defaultRate(mode: string): number {
  return TAX_MODES.find((m) => m.key === mode)?.defaultRate ?? 0;
}

export function VatSettings({ settings }: { settings: FinanceSettings }) {
  const router = useRouter();
  const [mode, setMode] = useState(settings.vat_mode);
  const [rate, setRate] = useState(settings.vat_rate);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await setFinanceVat(mode, rate);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="no-print flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Sales VAT</label>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setRate(defaultRate(e.target.value));
          }}
          className={inputCls}
        >
          {TAX_MODES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <input type="number" step="0.0001" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${inputCls} w-24`} title="e.g. 0.12 = 12%" />
      <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        Save VAT
      </button>
      <span className="text-xs text-slate-400">Confirm the regime with accounting.</span>
    </div>
  );
}
