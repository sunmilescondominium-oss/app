"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { UnitForm } from "@/components/inventory/unit-form";
import { CsvImport } from "@/components/inventory/csv-import";
import { FieldDefManager } from "@/components/inventory/field-def-manager";
import { setUnitActive } from "@/app/(app)/inventory/actions";
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
  | null;

export function InventoryTable({
  units,
  properties,
  fieldDefs,
  canWrite,
  canManageFields,
}: {
  units: Unit[];
  properties: { id: string; name: string }[];
  fieldDefs: FieldDefinition[];
  canWrite: boolean;
  canManageFields: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  const cols = canWrite ? 9 : 8;

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

      <div className="table-wrap">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
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
    </div>
  );
}
