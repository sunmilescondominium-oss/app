"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { CollectionForm } from "./collection-form";
import { EditCollectionForm } from "./edit-collection-form";
import { deleteCollection, bulkDeleteCollections } from "@/app/(app)/collections/actions";
import { peso } from "@/lib/collections/summary";
import { COLLECTION_CATEGORIES, COLLECTION_CHARGE_TYPES, PAYMENT_TYPES } from "@/lib/config";
import type { Collection, UnitOption } from "@/lib/collections/types";

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  COLLECTION_CATEGORIES.map((c) => [c.key, c.label]),
);
const PAY_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_TYPES.map((p) => [p.key, p.label]),
);
const CHARGE_LABEL: Record<string, string> = Object.fromEntries(
  COLLECTION_CHARGE_TYPES.map((c) => [c.key, c.label]),
);

function roleLabel(rk: string | null): string {
  if (!rk) return "—";
  return rk.charAt(0).toUpperCase() + rk.slice(1).replace(/_/g, " ");
}

export function CollectionsPanel({
  collections,
  unitOptions,
  canWrite,
  canEdit = false,
  isConsultant = false,
  date,
}: {
  collections: Collection[];
  unitOptions: UnitOption[];
  canWrite: boolean;
  canEdit?: boolean;
  isConsultant?: boolean;
  date: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const deletable = collections.filter((c) => !c.transmittal_id || isConsultant);
  const allSelected = deletable.length > 0 && deletable.every((c) => selected.has(c.id));
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllSel = () => setSelected((s) => (deletable.every((c) => s.has(c.id)) ? new Set() : new Set(deletable.map((c) => c.id))));
  async function bulkDelete() {
    if (!window.confirm(`Delete ${selected.size} collection(s)? Entries already transmitted are skipped.`)) return;
    setBulkBusy(true);
    const res = await bulkDeleteCollections([...selected]);
    setBulkBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    if (res.skipped.length) window.alert(`Deleted ${res.affected}, skipped ${res.skipped.length} (already transmitted).`);
    setSelected(new Set());
    router.refresh();
  }

  const done = () => {
    setOpen(false);
    router.refresh();
  };

  async function remove(c: Collection) {
    if (!window.confirm(`Delete this ${peso(c.amount)} entry?`)) return;
    setPendingId(c.id);
    const res = await deleteCollection(c.id);
    setPendingId(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap gap-2">
        {canWrite && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            + Add collection
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Print report
        </button>
      </div>

      {canWrite && selected.size > 0 && (
        <div className="no-print mb-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span className="font-medium text-amber-900">{selected.size} selected</span>
          <button type="button" onClick={bulkDelete} disabled={bulkBusy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Delete selected</button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-stone-500 hover:underline">Clear</button>
        </div>
      )}

      <div className="table-wrap">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {canWrite && <th className="no-print px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAllSel} aria-label="Select all" className="h-4 w-4 accent-amber-600" /></th>}
              <th className="px-4 py-3">Receipt #</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Charge</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Collected by</th>
              <th className="px-4 py-3 text-right">Amount</th>
              {(canWrite || canEdit) && <th className="no-print px-4 py-3 text-right">·</th>}
            </tr>
          </thead>
          <tbody>
            {collections.length === 0 && (
              <tr>
                <td colSpan={7 + (canWrite ? 1 : 0) + (canWrite || canEdit ? 1 : 0)} className="px-4 py-10 text-center text-stone-500">
                  No collections recorded for {date}.
                </td>
              </tr>
            )}
            {collections.map((c) => (
              <tr key={c.id} className="border-b border-stone-100 last:border-0">
                {canWrite && <td className="no-print px-3 py-3">{(!c.transmittal_id || isConsultant) && <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSel(c.id)} aria-label="Select" className="h-4 w-4 accent-amber-600" />}</td>}
                <td className="px-4 py-3 font-medium text-stone-900">
                  <div className="flex flex-col gap-0.5">
                    <span>{c.or_number ?? "—"}</span>
                    <div className="flex flex-wrap gap-1">
                      {c.receipt_type && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.receipt_type === "PR" ? "bg-amber-100 text-amber-800" : c.receipt_type === "AR" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {c.receipt_type}
                        </span>
                      )}
                      {c.check_date && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800" title={`Check #${c.check_number ?? "—"} ${c.check_bank ?? ""} due ${c.check_date}`}>
                          chk {c.check_date}
                        </span>
                      )}
                      {Number((c as unknown as Record<string, unknown>).reverted_count ?? 0) > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title={`Previously in transmittal ${String((c as unknown as Record<string, unknown>).last_reverted_from_ref ?? "")}`}>
                          reverted
                        </span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{CAT_LABEL[c.business_line] ?? c.business_line}</td>
                <td className="px-4 py-3">{c.unit?.unit_number ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {c.charge_type ? (CHARGE_LABEL[c.charge_type] ?? c.charge_type) : (c.unit_id ? <span className="text-stone-400">—</span> : null)}
                </td>
                <td className="px-4 py-3">{PAY_LABEL[c.payment_type] ?? c.payment_type}</td>
                <td className="px-4 py-3">{roleLabel(c.collected_by_role)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{peso(c.amount)}</td>
                {(canWrite || canEdit) && (
                  <td className="no-print px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {c.transmittal_id && (
                        <span className="text-[10px] font-semibold uppercase text-stone-400">transmitted</span>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setEditing(c)}
                          className="text-xs font-medium text-amber-700 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      {canWrite && (!c.transmittal_id || isConsultant) && (
                        <button
                          type="button"
                          onClick={() => remove(c)}
                          disabled={pendingId === c.id}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Add collection — ${date}`}>
        <CollectionForm date={date} unitOptions={unitOptions} onDone={done} />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.transmittal_id ? "Edit collection (authorized correction)" : "Edit collection"}>
        {editing && <EditCollectionForm collection={editing} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
    </div>
  );
}
