"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createUnit,
  updateUnit,
  type ActionResult,
} from "@/app/(app)/inventory/actions";
import { BUSINESS_LINES, UNIT_STATUSES } from "@/lib/config";
import type { Unit, FieldDefinition } from "@/lib/inventory/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function CustomField({ def, value }: { def: FieldDefinition; value: unknown }) {
  const name = `cf__${def.key}`;
  const v = value == null ? "" : String(value);

  if (def.data_type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name={name}
          defaultChecked={value === true || v === "true"}
          className="h-4 w-4 rounded border-slate-300"
        />
        {def.label}
      </label>
    );
  }

  return (
    <div>
      <label className={labelCls}>
        {def.label}
        {def.is_required && " *"}
      </label>
      {def.data_type === "select" ? (
        <select name={name} defaultValue={v} className={inputCls}>
          <option value="">—</option>
          {def.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={
            def.data_type === "number"
              ? "number"
              : def.data_type === "date"
                ? "date"
                : "text"
          }
          step={def.data_type === "number" ? "any" : undefined}
          defaultValue={v}
          className={inputCls}
        />
      )}
    </div>
  );
}

export function UnitForm({
  mode,
  unit,
  properties,
  fieldDefs,
  onDone,
}: {
  mode: "create" | "edit";
  unit?: Unit;
  properties: { id: string; name: string }[];
  fieldDefs: FieldDefinition[];
  onDone: () => void;
}) {
  const action =
    mode === "edit" && unit ? updateUnit.bind(null, unit.id) : createUnit;
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  const [propMode, setPropMode] = useState<string>(
    unit?.property_id ?? properties[0]?.id ?? "__new__",
  );
  const [businessLine, setBusinessLine] = useState<string>(
    unit?.business_line ?? "rental",
  );

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const applicable = fieldDefs.filter(
    (d) => d.business_line === businessLine || d.business_line === null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {/* Property */}
      {mode === "create" ? (
        <div>
          <label className={labelCls}>Property</label>
          <select
            value={propMode}
            onChange={(e) => setPropMode(e.target.value)}
            className={inputCls}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="__new__">+ New property…</option>
          </select>
          <input
            type="hidden"
            name="property_id"
            value={propMode === "__new__" ? "" : propMode}
          />
          {propMode === "__new__" && (
            <input
              name="new_property_name"
              placeholder="New property / building name"
              className={`${inputCls} mt-2`}
            />
          )}
        </div>
      ) : (
        <div>
          <label className={labelCls}>Property</label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {unit?.property?.name ?? "—"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Unit / room number *</label>
          <input
            name="unit_number"
            required
            defaultValue={unit?.unit_number ?? ""}
            className={inputCls}
            placeholder="e.g. H01, 310, Deluxe-201"
          />
        </div>
        <div>
          <label className={labelCls}>Unit type</label>
          <input
            name="unit_type"
            defaultValue={unit?.unit_type ?? ""}
            className={inputCls}
            placeholder="Studio, 1BR, Suite…"
          />
        </div>
        <div>
          <label className={labelCls}>Business line *</label>
          <select
            name="business_line"
            value={businessLine}
            onChange={(e) => setBusinessLine(e.target.value)}
            className={inputCls}
          >
            {BUSINESS_LINES.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select
            name="status"
            defaultValue={unit?.status ?? "available"}
            className={inputCls}
          >
            {UNIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Level / Floor</label>
          <input
            name="floor"
            defaultValue={unit?.floor ?? ""}
            className={inputCls}
            placeholder="Ground, 2, 15…"
          />
        </div>
        <div>
          <label className={labelCls}>Area (sqm)</label>
          <input
            name="area_sqm"
            type="number"
            step="0.01"
            defaultValue={unit?.area_sqm ?? ""}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>TCP — total contract price (condo sales)</label>
          <input
            name="tcp"
            type="number"
            step="0.01"
            defaultValue={unit?.tcp ?? ""}
            className={inputCls}
            placeholder="Leave blank for rentals / hotel"
          />
        </div>
      </div>

      {/* Admin-defined custom fields for the selected business line */}
      {applicable.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {BUSINESS_LINES.find((b) => b.key === businessLine)?.label} details
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {applicable.map((d) => (
              <CustomField key={d.id} def={d} value={unit?.custom_fields?.[d.key]} />
            ))}
          </div>
        </div>
      )}

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add unit"}
        </button>
      </div>
    </form>
  );
}
