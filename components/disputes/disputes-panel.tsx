"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { DisputeForm } from "./dispute-form";
import { bulkDeleteDisputes } from "@/app/(app)/disputes/actions";
import { DISPUTE_STATUSES } from "@/lib/config";
import type { Dispute } from "@/lib/disputes/types";
import type { UnitOption } from "@/lib/collections/types";

const STATUS_CLS: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-emerald-100 text-emerald-800",
  escalated: "bg-red-100 text-red-700",
};
const STATUS_LABEL = Object.fromEntries(DISPUTE_STATUSES.map((s) => [s.key, s.label]));

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[status] ?? "bg-stone-100 text-stone-600"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

type ModalState = { kind: "add" } | { kind: "edit"; dispute: Dispute } | null;

export function DisputesPanel({
  active,
  references,
  unitOptions,
  canWrite,
  canSeeLawyerNotes,
  canHardDelete = false,
}: {
  active: Dispute[];
  references: Dispute[];
  unitOptions: UnitOption[];
  canWrite: boolean;
  canSeeLawyerNotes: boolean;
  canHardDelete?: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const allSelected = active.length > 0 && active.every((d) => selected.has(d.id));
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllSel = () => setSelected((s) => (active.every((d) => s.has(d.id)) ? new Set() : new Set(active.map((d) => d.id))));
  async function bulkDelete() {
    if (!window.confirm(`Delete ${selected.size} case(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    const res = await bulkDeleteDisputes([...selected]);
    setBulkBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setSelected(new Set());
    router.refresh();
  }
  const done = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <div>
      {canWrite && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setModal({ kind: "add" })}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            + Add case
          </button>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Active cases
      </h2>
      {canHardDelete && selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span className="font-medium text-amber-900">{selected.size} selected</span>
          <button type="button" onClick={bulkDelete} disabled={bulkBusy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Delete selected</button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-stone-500 hover:underline">Clear</button>
        </div>
      )}
      <div className="mb-8 table-wrap">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {canHardDelete && <th className="px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAllSel} aria-label="Select all" className="h-4 w-4 accent-amber-600" /></th>}
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Next action</th>
              <th className="px-4 py-3">Target</th>
              {canWrite && <th className="px-4 py-3 text-right">·</th>}
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr>
                <td colSpan={(canWrite ? 6 : 5) + (canHardDelete ? 1 : 0)} className="px-4 py-10 text-center text-stone-500">
                  No active cases. {canWrite && "Add one to begin."}
                </td>
              </tr>
            )}
            {active.map((d) => (
              <tr key={d.id} className="border-b border-stone-100 last:border-0 align-top">
                {canHardDelete && <td className="px-3 py-3"><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSel(d.id)} aria-label="Select" className="h-4 w-4 accent-amber-600" /></td>}
                <td className="px-4 py-3">
                  <p className="font-medium text-stone-900">{d.issue_type}</p>
                  {canSeeLawyerNotes && d.lawyer_notes && (
                    <p className="mt-0.5 text-xs italic text-stone-400">⚖ {d.lawyer_notes}</p>
                  )}
                </td>
                <td className="px-4 py-3">{d.unit?.unit_number ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill status={d.status} />
                </td>
                <td className="px-4 py-3">{d.next_action ?? "—"}</td>
                <td className="px-4 py-3">{d.target_date ?? "—"}</td>
                {canWrite && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setModal({ kind: "edit", dispute: d })}
                      className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Reference library
      </h2>
      <p className="mb-2 text-xs text-stone-400">
        Historical cases seeded as institutional knowledge — start new disputes from these, not from zero.
      </p>
      <div className="table-wrap">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last action</th>
            </tr>
          </thead>
          <tbody>
            {references.map((d) => (
              <tr key={d.id} className="border-b border-stone-100 last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-stone-900">{d.issue_type}</p>
                  {canSeeLawyerNotes && d.lawyer_notes && (
                    <p className="mt-0.5 text-xs italic text-stone-400">⚖ {d.lawyer_notes}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-500">{d.case_ref ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill status={d.status} />
                </td>
                <td className="px-4 py-3">{d.last_action ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal?.kind === "add"} onClose={() => setModal(null)} title="Add case">
        <DisputeForm mode="create" unitOptions={unitOptions} canSeeLawyerNotes={canSeeLawyerNotes} onDone={done} />
      </Modal>
      <Modal
        open={modal?.kind === "edit"}
        onClose={() => setModal(null)}
        title={modal?.kind === "edit" ? "Edit case" : "Edit"}
      >
        {modal?.kind === "edit" && (
          <DisputeForm
            mode="edit"
            dispute={modal.dispute}
            unitOptions={unitOptions}
            canSeeLawyerNotes={canSeeLawyerNotes}
            onDone={done}
          />
        )}
      </Modal>
    </div>
  );
}
