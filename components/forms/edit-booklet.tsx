"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBooklet } from "@/app/(app)/forms/actions";
import { BUSINESS_LINES } from "@/lib/config";
import type { FormType, BusinessEntity, BookletRow } from "@/lib/forms/types";

type Custodian = { userId: string; label: string; role: string | null };
type Role = { key: string; label: string };

interface Props {
  booklet: BookletRow;
  types: FormType[];
  custodians: Custodian[];
  entities: BusinessEntity[];
  roles: Role[];
  onClose: () => void;
}

export function EditBooklet({ booklet, types, custodians, entities, roles, onClose }: Props) {
  const router = useRouter();
  const [f, setF] = useState({
    bookletNo: booklet.bookletNo,
    formTypeId: booklet.typeId || (types[0]?.id ?? ""),
    businessEntityId: booklet.entityId ?? "",
    birAtpNo: booklet.birAtpNo ?? "",
    birAtpDate: booklet.birAtpDate ?? "",
    printerName: booklet.printerName ?? "",
    custodianUserId: booklet.custodianUserId ?? "",
    businessLine: booklet.businessLine ?? "",
    issuedToRole: booklet.issuedToRole ?? "",
    issuedToLabel: booklet.issuedToLabel ?? "",
    status: booklet.status,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const showBir = types.find((t) => t.id === f.formTypeId)?.birReportable ?? true;

  async function submit() {
    setErr(null);
    setBusy(true);
    const cust = custodians.find((c) => c.userId === f.custodianUserId);
    const res = await updateBooklet(booklet.id, {
      bookletNo: f.bookletNo,
      formTypeId: f.formTypeId,
      businessEntityId: f.businessEntityId,
      birAtpNo: f.birAtpNo,
      birAtpDate: f.birAtpDate,
      printerName: f.printerName,
      custodianUserId: f.custodianUserId,
      custodianRole: cust?.role ?? "",
      businessLine: f.businessLine,
      issuedToRole: f.issuedToRole,
      issuedToLabel: f.issuedToLabel,
      status: f.status,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    onClose();
    router.refresh();
  }

  const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none";
  const lbl = "mb-1 block text-xs text-stone-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-stone-800">Edit booklet</h3>
            <p className="text-xs text-stone-500 mt-0.5">Serial range ({booklet.prefix}{booklet.from}–{booklet.prefix}{booklet.to}) cannot be changed.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors" title="Close">✕</button>
        </div>

        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className={lbl}>Form type *</span>
              <select value={f.formTypeId} onChange={(e) => set("formTypeId", e.target.value)} className={input}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className={lbl}>Booklet / pad no. *</span>
              <input value={f.bookletNo} onChange={(e) => set("bookletNo", e.target.value)} className={input} />
            </label>

            {showBir ? (
              <>
                <label className="text-sm sm:col-span-2"><span className={lbl}>Registered business (BIR)</span>
                  <select value={f.businessEntityId} onChange={(e) => set("businessEntityId", e.target.value)} className={input}>
                    <option value="">— none —</option>
                    {entities.map((en) => <option key={en.id} value={en.id}>{en.name}{en.tin ? ` · TIN ${en.tin}` : ""}</option>)}
                  </select>
                </label>
                <label className="text-sm"><span className={lbl}>BIR Authority to Print (ATP) no.</span>
                  <input value={f.birAtpNo} onChange={(e) => set("birAtpNo", e.target.value)} placeholder="ATP / permit no." className={input} />
                </label>
                <label className="text-sm"><span className={lbl}>ATP date</span>
                  <input type="date" value={f.birAtpDate} onChange={(e) => set("birAtpDate", e.target.value)} className={input} />
                </label>
                <label className="text-sm sm:col-span-2"><span className={lbl}>Accredited printer</span>
                  <input value={f.printerName} onChange={(e) => set("printerName", e.target.value)} placeholder="printer name / accreditation" className={input} />
                </label>
              </>
            ) : (
              <p className="text-xs text-stone-500 sm:col-span-2">Internal form — not reported to the BIR.</p>
            )}

            <label className="text-sm"><span className={lbl}>Custodian (staff)</span>
              <select value={f.custodianUserId} onChange={(e) => set("custodianUserId", e.target.value)} className={input}>
                <option value="">— unassigned —</option>
                {custodians.map((c) => <option key={c.userId} value={c.userId}>{c.label}{c.role ? ` (${c.role.replace(/_/g, " ")})` : ""}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className={lbl}>Business line</span>
              <select value={f.businessLine} onChange={(e) => set("businessLine", e.target.value)} className={input}>
                <option value="">— select —</option>
                {BUSINESS_LINES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className={lbl}>Issued to — role</span>
              <select value={f.issuedToRole} onChange={(e) => set("issuedToRole", e.target.value)} className={input}>
                <option value="">— select —</option>
                {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className={lbl}>Issued to — station / label</span>
              <input value={f.issuedToLabel} onChange={(e) => set("issuedToLabel", e.target.value)} placeholder="e.g. Front Desk" className={input} />
            </label>
            <label className="text-sm"><span className={lbl}>Status</span>
              <select value={f.status} onChange={(e) => set("status", e.target.value)} className={input}>
                <option value="active">active</option>
                <option value="closed">closed</option>
              </select>
            </label>
          </div>

          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
