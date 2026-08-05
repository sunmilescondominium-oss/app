"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPayee } from "@/app/(app)/payables/actions";
import { PAYEE_KINDS, type Payee } from "@/lib/payables/types";

export function PayeeManager({ payees }: { payees: Payee[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", kind: "agent", parentPayeeId: "", overrideRate: "", commissionRate: "", tin: "", contact: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const brokers = payees.filter((p) => p.kind === "broker");

  async function submit() {
    setErr(null); setBusy(true);
    const res = await createPayee({ name: f.name, kind: f.kind, parentPayeeId: f.parentPayeeId, overrideRate: Number(f.overrideRate), commissionRate: Number(f.commissionRate), tin: f.tin, contact: f.contact });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setF({ name: "", kind: "agent", parentPayeeId: "", overrideRate: "", commissionRate: "", tin: "", contact: "" });
    setOpen(false);
    router.refresh();
  }

  const input = "rounded-lg border border-stone-300 px-3 py-2 text-sm";
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Payees (brokers, agents, staff)</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-amber-700 hover:underline">{open ? "Cancel" : "+ Add payee"}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {payees.length === 0 && <span className="text-xs text-stone-400">No payees yet.</span>}
        {payees.map((p) => (
          <span key={p.id} className="rounded-full bg-white px-3 py-1 text-xs text-stone-700 ring-1 ring-stone-200">
            {p.name} <span className="text-stone-400">· {p.kind}</span>
            {p.parentName && <span className="text-stone-400"> → {p.parentName}</span>}
            {p.kind === "agent" && p.overrideRate > 0 && <span className="text-stone-400"> · ovr {Math.round(p.overrideRate * 100)}%</span>}
          </span>
        ))}
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Name *" className={input} />
          <select value={f.kind} onChange={(e) => set("kind", e.target.value)} className={input}>
            {PAYEE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          {(f.kind === "agent" || f.kind === "salesperson") && (
            <>
              <select value={f.parentPayeeId} onChange={(e) => set("parentPayeeId", e.target.value)} className={input}>
                <option value="">— broker (for override) —</option>
                {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input value={f.overrideRate} onChange={(e) => set("overrideRate", e.target.value)} placeholder="Broker override % (e.g. 2)" className={input} />
            </>
          )}
          <input value={f.commissionRate} onChange={(e) => set("commissionRate", e.target.value)} placeholder="Default commission % (optional)" className={input} />
          <input value={f.tin} onChange={(e) => set("tin", e.target.value)} placeholder="TIN" className={input} />
          <input value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Contact" className={`${input} sm:col-span-2`} />
          {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2"><button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{busy ? "Saving…" : "Add payee"}</button></div>
        </div>
      )}
    </div>
  );
}
