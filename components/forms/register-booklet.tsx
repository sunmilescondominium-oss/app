"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBooklet } from "@/app/(app)/forms/actions";
import type { FormType, BusinessEntity } from "@/lib/forms/types";

type Custodian = { userId: string; label: string; role: string | null };

export function RegisterBooklet({ types, custodians, entities }: { types: FormType[]; custodians: Custodian[]; entities: BusinessEntity[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ formTypeId: types[0]?.id ?? "", bookletNo: "", prefix: "", from: "", to: "", padWidth: "6", custodianUserId: "", receivedFrom: "", receivedAt: "", notes: "", businessEntityId: entities[0]?.id ?? "", birAtpNo: "", birAtpDate: "", printerName: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const count = Number(f.to) - Number(f.from) + 1;

  async function submit() {
    setErr(null); setBusy(true);
    const cust = custodians.find((c) => c.userId === f.custodianUserId);
    const res = await createBooklet({
      formTypeId: f.formTypeId, bookletNo: f.bookletNo, prefix: f.prefix,
      from: Number(f.from), to: Number(f.to), padWidth: Number(f.padWidth),
      custodianUserId: f.custodianUserId, custodianRole: cust?.role ?? "",
      receivedFrom: f.receivedFrom, receivedAt: f.receivedAt, notes: f.notes,
      businessEntityId: f.businessEntityId, birAtpNo: f.birAtpNo, birAtpDate: f.birAtpDate, printerName: f.printerName,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setOpen(false);
    setF({ formTypeId: types[0]?.id ?? "", bookletNo: "", prefix: "", from: "", to: "", padWidth: "6", custodianUserId: "", receivedFrom: "", receivedAt: "", notes: "", businessEntityId: entities[0]?.id ?? "", birAtpNo: "", birAtpDate: "", printerName: "" });
    if (res.id) router.push(`/forms/${res.id}`); else router.refresh();
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">+ Register booklet</button>;
  }

  const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-stone-800">Register accountable-form booklet</h3>
        <button onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:underline">Cancel</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block text-stone-600">Form type *</span>
          <select value={f.formTypeId} onChange={(e) => set("formTypeId", e.target.value)} className={input}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Booklet / pad no. *</span>
          <input value={f.bookletNo} onChange={(e) => set("bookletNo", e.target.value)} placeholder="e.g. OR-BKLT-001" className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Serial prefix</span>
          <input value={f.prefix} onChange={(e) => set("prefix", e.target.value)} placeholder="e.g. OR-" className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Zero-pad width</span>
          <input type="number" min={0} max={12} value={f.padWidth} onChange={(e) => set("padWidth", e.target.value)} className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Serial from *</span>
          <input type="number" value={f.from} onChange={(e) => set("from", e.target.value)} placeholder="1" className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Serial to *</span>
          <input type="number" value={f.to} onChange={(e) => set("to", e.target.value)} placeholder="50" className={input} />
        </label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block text-stone-600">Registered business (BIR)</span>
          <select value={f.businessEntityId} onChange={(e) => set("businessEntityId", e.target.value)} className={input}>
            <option value="">— none —</option>
            {entities.map((en) => <option key={en.id} value={en.id}>{en.name}{en.tin ? ` · TIN ${en.tin}` : ""}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">BIR Authority to Print (ATP) no.</span>
          <input value={f.birAtpNo} onChange={(e) => set("birAtpNo", e.target.value)} placeholder="ATP / permit no." className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">ATP date</span>
          <input type="date" value={f.birAtpDate} onChange={(e) => set("birAtpDate", e.target.value)} className={input} />
        </label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block text-stone-600">Accredited printer</span>
          <input value={f.printerName} onChange={(e) => set("printerName", e.target.value)} placeholder="printer name / accreditation" className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Custodian (staff)</span>
          <select value={f.custodianUserId} onChange={(e) => set("custodianUserId", e.target.value)} className={input}>
            <option value="">— unassigned —</option>
            {custodians.map((c) => <option key={c.userId} value={c.userId}>{c.label}{c.role ? ` (${c.role.replace(/_/g, " ")})` : ""}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Received from</span>
          <input value={f.receivedFrom} onChange={(e) => set("receivedFrom", e.target.value)} placeholder="printer / BIR / head office" className={input} />
        </label>
        <label className="text-sm"><span className="mb-1 block text-stone-600">Date received</span>
          <input type="date" value={f.receivedAt} onChange={(e) => set("receivedAt", e.target.value)} className={input} />
        </label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block text-stone-600">Notes</span>
          <input value={f.notes} onChange={(e) => set("notes", e.target.value)} className={input} />
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-stone-500">{Number.isFinite(count) && count > 0 ? `${count} serial(s) will be created` : "Enter a serial range"}</span>
        <button onClick={submit} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{busy ? "Creating…" : "Register booklet"}</button>
      </div>
    </div>
  );
}
