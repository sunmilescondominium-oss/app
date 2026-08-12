"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { UnitForm } from "@/components/inventory/unit-form";
import { CsvImport } from "@/components/inventory/csv-import";
import { FieldDefManager } from "@/components/inventory/field-def-manager";
import { setUnitActive, bulkSetUnitsActive, bulkDeleteUnits } from "@/app/(app)/inventory/actions";
import { BUSINESS_LINES } from "@/lib/config";
import type { Unit, FieldDefinition } from "@/lib/inventory/types";

const BL_LABEL: Record<string, string> = Object.fromEntries(
  BUSINESS_LINES.map((b) => [b.key, b.label]),
);

const STATUS_META: Record<string, { label: string; cls: string }> = {
  available: { label: "Available", cls: "bg-emerald-100 text-emerald-800" },
  occupied: { label: "Occupied", cls: "bg-stone-200 text-stone-700" },
  reserved: { label: "Reserved", cls: "bg-amber-100 text-amber-800" },
  under_maintenance: { label: "Maintenance", cls: "bg-orange-100 text-orange-800" },
  blocked: { label: "Blocked", cls: "bg-red-100 text-red-700" },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? {
    label: status,
    cls: "bg-stone-100 text-stone-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

type ModalState =
  | { kind: "add" }
  | { kind: "edit"; unit: Unit }
  | { kind: "import" }
  | { kind: "fields" }
  | { kind: "confirm_delete"; ids: string[]; label: string }
  | null;

export function InventoryTable({
  units,
  properties,
  fieldDefs,
  canWrite,
  canManageFields,
  canHardDelete,
}: {
  units: Unit[];
  properties: { id: string; name: string }[];
  fieldDefs: FieldDefinition[];
  canWrite: boolean;
  canManageFields: boolean;
  canHardDelete: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const allSelected = units.length > 0 && units.every((u) => selected.has(u.id));
  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((s) => (units.every((u) => s.has(u.id)) ? new Set() : new Set(units.map((u) => u.id))));
  }
  async function bulkDeactivate() {
    setBulkBusy(true);
    const res = await bulkSetUnitsActive([...selected], false);
    setBulkBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setSelected(new Set());
    router.refresh();
  }
  async function bulkDelete() {
    setModal({ kind: "confirm_delete", ids: [...selected], label: `${selected.size} selected unit(s)` });
  }

  async function singleDelete(u: Unit) {
    setModal({ kind: "confirm_delete", ids: [u.id], label: `unit ${u.unit_number}` });
  }

  async function confirmDelete(ids: string[]) {
    setBulkBusy(true);
    const res = await bulkDeleteUnits(ids);
    setBulkBusy(false);
    setModal(null);
    if (!res.ok) { window.alert(res.error); return; }
    if (res.skipped.length) window.alert(`Deleted ${res.affected}. Skipped ${res.skipped.length} (linked to other records — deactivate those instead).`);
    setSelected(new Set());
    router.refresh();
  }

  const close = () => setModal(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };

  async function toggleActive(u: Unit) {
    if (
      u.is_active &&
      !window.confirm(`Deactivate ${u.unit_number}? It will be hidden by default.`)
    )
      return;
    setPendingId(u.id);
    const res = await setUnitActive(u.id, !u.is_active);
    setPendingId(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  const cols = (canWrite ? 9 : 8) + (canWrite ? 1 : 0);

  return (
    <div>
      {(canWrite || canManageFields) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => setModal({ kind: "add" })}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                + Add unit
              </button>
              <button
                type="button"
                onClick={() => setModal({ kind: "import" })}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Import CSV
              </button>
            </>
          )}
          {canManageFields && (
            <button
              type="button"
              onClick={() => setModal({ kind: "fields" })}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Manage fields
            </button>
          )}
        </div>
      )}

      {canWrite && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span className="font-medium text-amber-900">{selected.size} selected</span>
          <button type="button" onClick={bulkDeactivate} disabled={bulkBusy} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50">Deactivate</button>
          {canHardDelete && (
            <button type="button" onClick={bulkDelete} disabled={bulkBusy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Delete permanently</button>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-stone-500 hover:underline">Clear</button>
        </div>
      )}

      <div className="table-wrap">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {canWrite && (
                <th className="px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="h-4 w-4 accent-amber-600" /></th>
              )}
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Unit / room</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Level / Tower</th>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Area</th>
              <th className="px-4 py-3 text-right">TCP</th>
              {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {units.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-4 py-10 text-center text-stone-500">
                  No units match. {canWrite && "Add one or import a CSV to begin."}
                </td>
              </tr>
            )}
            {units.map((u) => {
              const tower = u.custom_fields?.tower;
              return (
                <tr
                  key={u.id}
                  className={`border-b border-stone-100 last:border-0 ${
                    u.is_active ? "" : "bg-stone-50/60 text-stone-400"
                  }`}
                >
                  {canWrite && (
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} aria-label={`Select ${u.unit_number}`} className="h-4 w-4 accent-amber-600" /></td>
                  )}
                  <td className="px-4 py-3">{u.property?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {u.unit_number}
                    {!u.is_active && (
                      <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-500">
                        inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{u.unit_type ?? "—"}</td>
                  <td className="px-4 py-3">
                    {u.floor ?? "—"}
                    {tower ? (
                      <span className="text-stone-500"> · {String(tower)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{BL_LABEL[u.business_line] ?? u.business_line}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {u.area_sqm != null ? `${u.area_sqm} m²` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {u.tcp != null ? `₱${Number(u.tcp).toLocaleString()}` : "—"}
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setModal({ kind: "edit", unit: u })}
                          className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          disabled={pendingId === u.id}
                          className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                        >
                          {u.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                        {canHardDelete && (
                          <button
                            type="button"
                            onClick={() => singleDelete(u)}
                            className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal?.kind === "add"} onClose={close} title="Add unit / room">
        <UnitForm
          mode="create"
          properties={properties}
          fieldDefs={fieldDefs}
          onDone={done}
        />
      </Modal>

      <Modal
        open={modal?.kind === "edit"}
        onClose={close}
        title={modal?.kind === "edit" ? `Edit ${modal.unit.unit_number}` : "Edit unit"}
      >
        {modal?.kind === "edit" && (
          <UnitForm
            mode="edit"
            unit={modal.unit}
            properties={properties}
            fieldDefs={fieldDefs}
            onDone={done}
          />
        )}
      </Modal>

      <Modal open={modal?.kind === "import"} onClose={close} title="Import units from CSV">
        <CsvImport onDone={done} />
      </Modal>

      <Modal open={modal?.kind === "fields"} onClose={close} title="Manage custom fields">
        <FieldDefManager fieldDefs={fieldDefs} onDone={done} />
      </Modal>

      <Modal open={modal?.kind === "confirm_delete"} onClose={close} title="Delete permanently?">
        {modal?.kind === "confirm_delete" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <p className="font-semibold">You are about to permanently delete:</p>
              <p className="mt-1">{modal.label}</p>
            </div>
            <ul className="space-y-1 text-sm text-stone-600">
              <li>⚠ This action <strong>cannot be undone</strong>.</li>
              <li>Units linked to buyers, leases, or collections will be <strong>skipped</strong> — deactivate those instead.</li>
            </ul>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={close}
                disabled={bulkBusy}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(modal.ids)}
                disabled={bulkBusy}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {bulkBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
