"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setGlobalTax, setRoomTax, clearRoomTax } from "@/app/(app)/hotel/actions";
import { TAX_MODES } from "@/lib/config";
import type { TaxSetting, RoomTaxRow } from "@/lib/hotel/types";

const inputCls =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

const MODE_LABEL = Object.fromEntries(TAX_MODES.map((m) => [m.key, m.label]));
function defaultRate(mode: string): number {
  return TAX_MODES.find((m) => m.key === mode)?.defaultRate ?? 0;
}

export function TaxSettings({
  global,
  roomTax,
  units,
  onDone,
}: {
  global: TaxSetting;
  roomTax: RoomTaxRow[];
  units: { id: string; unit_number: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [gMode, setGMode] = useState(global.tax_mode);
  const [gRate, setGRate] = useState(global.tax_rate);

  const [ru, setRu] = useState(units[0]?.id ?? "");
  const [rMode, setRMode] = useState("vat_inclusive");
  const [rRate, setRRate] = useState(0.12);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Tax applies to <strong>all rooms</strong> by default. Add a <strong>per-room override</strong> where it
        differs. Confirm the regime with accounting.
      </p>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Apply to all rooms</p>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={gMode}
            onChange={(e) => {
              setGMode(e.target.value);
              setGRate(defaultRate(e.target.value));
            }}
            className={inputCls}
          >
            {TAX_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.0001"
            value={gRate}
            onChange={(e) => setGRate(Number(e.target.value))}
            className={`${inputCls} w-24`}
            title="Rate (e.g. 0.12 = 12%)"
          />
          <button
            type="button"
            onClick={() => run(() => setGlobalTax(gMode, gRate))}
            disabled={busy}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Per-room overrides</p>
        {roomTax.length > 0 && (
          <ul className="mb-2 space-y-1 text-sm">
            {roomTax.map((r) => (
              <li key={r.unit_id} className="flex items-center justify-between">
                <span>
                  {r.unit_number ?? r.unit_id} · {MODE_LABEL[r.tax_mode] ?? r.tax_mode}
                </span>
                <button
                  type="button"
                  onClick={() => run(() => clearRoomTax(r.unit_id))}
                  disabled={busy}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  clear
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <select value={ru} onChange={(e) => setRu(e.target.value)} className={inputCls}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unit_number}
              </option>
            ))}
          </select>
          <select
            value={rMode}
            onChange={(e) => {
              setRMode(e.target.value);
              setRRate(defaultRate(e.target.value));
            }}
            className={inputCls}
          >
            {TAX_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.0001"
            value={rRate}
            onChange={(e) => setRRate(Number(e.target.value))}
            className={`${inputCls} w-24`}
          />
          <button
            type="button"
            onClick={() => run(() => setRoomTax(ru, rMode, rRate))}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Set override
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Close
        </button>
      </div>
    </div>
  );
}
