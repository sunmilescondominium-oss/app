"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBusinessEntity } from "@/app/(app)/forms/actions";
import type { BusinessEntity } from "@/lib/forms/types";

export function BusinessEntities({ entities }: { entities: BusinessEntity[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", tradeName: "", tin: "", rdo: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    setErr(null); setBusy(true);
    const res = await createBusinessEntity(f);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setF({ name: "", tradeName: "", tin: "", rdo: "", address: "" });
    setOpen(false);
    router.refresh();
  }

  const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm";
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Registered businesses (BIR)</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-amber-700 hover:underline">{open ? "Cancel" : "+ Add business"}</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {entities.length === 0 && <span className="text-xs text-stone-400">No registered businesses yet — add each one so booklets can be tagged.</span>}
        {entities.map((e) => (
          <span key={e.id} className="rounded-full bg-white px-3 py-1 text-xs text-stone-700 ring-1 ring-stone-200">{e.name}{e.tin ? ` · TIN ${e.tin}` : ""}</span>
        ))}
      </div>

      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Registered name *" className={input} />
          <input value={f.tradeName} onChange={(e) => set("tradeName", e.target.value)} placeholder="Trade name" className={input} />
          <input value={f.tin} onChange={(e) => set("tin", e.target.value)} placeholder="TIN" className={input} />
          <input value={f.rdo} onChange={(e) => set("rdo", e.target.value)} placeholder="BIR RDO code" className={input} />
          <input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Registered address" className={`${input} sm:col-span-2`} />
          {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2">
            <button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{busy ? "Saving…" : "Add business"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
