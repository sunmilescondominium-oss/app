"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setReceiptSeries } from "@/app/(app)/transmittals/actions";

type Series = { context: string; prefix: string; next_no: number };
const cls = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function Row({ s }: { s: Series }) {
  const router = useRouter();
  const [prefix, setPrefix] = useState(s.prefix);
  const [nextNo, setNextNo] = useState(s.next_no);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await setReceiptSeries(s.context as "hotel" | "rental", prefix, nextNo);
    setBusy(false);
    if (!res.ok) return window.alert(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <span className="w-16 pb-2 text-sm font-medium capitalize text-slate-600">{s.context}</span>
      <div>
        <label className="mb-1 block text-[11px] text-slate-500">Prefix</label>
        <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={`${cls} w-24`} />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-slate-500">Next number</label>
        <input type="number" min="1" value={nextNo} onChange={(e) => setNextNo(Number(e.target.value))} className={`${cls} w-28`} />
      </div>
      <span className="pb-2 text-xs text-slate-400">next: {prefix}{String(nextNo).padStart(6, "0")}</span>
      <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}

export function ReceiptSeriesPanel({ series }: { series: Series[] }) {
  return (
    <div className="no-print mb-6 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-slate-800">Acknowledgement Receipt series</p>
      <p className="mb-3 text-xs text-slate-400">Set the series to match your physical AR booklets (hotel & rental). New receipts continue from the next number.</p>
      <div className="space-y-2">
        {series.map((s) => <Row key={s.context} s={s} />)}
      </div>
    </div>
  );
}
