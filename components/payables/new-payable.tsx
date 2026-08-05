"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPayable } from "@/app/(app)/payables/actions";
import { PAYABLE_TYPES, type Payee, type PayableType } from "@/lib/payables/types";

export function NewPayable({ payees }: { payees: Payee[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ payeeId: "", ptype: "commission" as PayableType, amount: "", description: "", businessLine: "", refNo: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const payee = payees.find((p) => p.id === f.payeeId);
  const willOverride = f.ptype === "commission" && payee?.parentPayeeId && payee.overrideRate > 0;

  async function submit() {
    setErr(null); setBusy(true);
    const res = await createPayable({ payeeId: f.payeeId, ptype: f.ptype, amount: Number(f.amount), description: f.description, businessLine: f.businessLine, refNo: f.refNo });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setF({ payeeId: "", ptype: "commission", amount: "", description: "", businessLine: "", refNo: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">+ New payable</button>;

  const input = "rounded-lg border border-stone-300 px-3 py-2 text-sm w-full";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-stone-800">New payable</h3><button onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:underline">Cancel</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-stone-600">Payee *</span>
          <select value={f.payeeId} onChange={(e) => set("payeeId", e.target.value)} className={input}>
            <option value="">— choose —</option>
            {payees.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Type *</span>
          <select value={f.ptype} onChange={(e) => set("ptype", e.target.value)} className={input}>
            {PAYABLE_TYPES.filter((t) => t.key !== "override").map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Amount *</span>
          <input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Business line / project</span>
          <input value={f.businessLine} onChange={(e) => set("businessLine", e.target.value)} placeholder="airbnb · condo_sales…" className={input} />
        </label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block text-stone-600">Description</span>
          <input value={f.description} onChange={(e) => set("description", e.target.value)} className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Reference (unit / sale / promo)</span>
          <input value={f.refNo} onChange={(e) => set("refNo", e.target.value)} className={input} />
        </label>
      </div>
      {willOverride && <p className="mt-2 text-xs text-amber-700">A broker override of {Math.round((payee!.overrideRate) * 100)}% to {payee!.parentName} will be created automatically.</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3 text-right"><button onClick={submit} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{busy ? "Saving…" : "Create payable"}</button></div>
    </div>
  );
}
