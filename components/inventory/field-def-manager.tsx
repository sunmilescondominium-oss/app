"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFieldDefinition,
  setFieldDefinitionActive,
  type ActionResult,
} from "@/app/(app)/inventory/actions";
import { BUSINESS_LINES } from "@/lib/config";
import type { FieldDefinition } from "@/lib/inventory/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

export function FieldDefManager({
  fieldDefs,
  onDone,
}: {
  fieldDefs: FieldDefinition[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(createFieldDefinition, undefined);
  const [dataType, setDataType] = useState("text");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  async function deactivate(d: FieldDefinition) {
    if (!window.confirm(`Remove the "${d.label}" field? Existing values stay stored.`))
      return;
    setBusy(d.id);
    const res = await setFieldDefinitionActive(d.id, false);
    setBusy(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Current fields
        </p>
        {fieldDefs.length === 0 ? (
          <p className="text-sm text-slate-500">No custom fields yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {fieldDefs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-slate-800">{d.label}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {d.business_line ?? "all lines"} · {d.data_type}
                    {d.is_required ? " · required" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deactivate(d)}
                  disabled={busy === d.id}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={formAction} className="space-y-3 rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add a field
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Label *</label>
            <input name="label" required className={inputCls} placeholder="e.g. Turnover date" />
          </div>
          <div>
            <label className={labelCls}>Applies to</label>
            <select name="business_line" className={inputCls}>
              <option value="">All business lines</option>
              {BUSINESS_LINES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select
              name="data_type"
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              className={inputCls}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Dropdown</option>
              <option value="boolean">Yes / No</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Sort order</label>
            <input name="sort_order" type="number" defaultValue="100" className={inputCls} />
          </div>
          {dataType === "select" && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Options (comma-separated)</label>
              <input
                name="options"
                className={inputCls}
                placeholder="North, South, East, West"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="is_required" className="h-4 w-4 rounded border-slate-300" />
            Required
          </label>
        </div>

        {state && !state.ok && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add field"}
          </button>
        </div>
      </form>

      <p className="text-xs text-slate-400">
        New fields appear on the unit form immediately — no deploy needed.
      </p>
    </div>
  );
}
