"use client";

import { useActionState, useEffect } from "react";
import {
  createCollection,
  type ActionResult,
} from "@/app/(app)/collections/actions";
import { COLLECTION_CATEGORIES, PAYMENT_TYPES } from "@/lib/config";
import type { UnitOption } from "@/lib/collections/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

// TODO(client-confirm): which roles are attributable as "collected by".
const COLLECTED_BY = [
  { key: "hotel_rental_monitoring", label: "Hotel & Rental Monitoring" },
  { key: "hotel_cashier", label: "Hotel Cashier" },
  { key: "accounting", label: "Accounting" },
  { key: "guard", label: "Guard" },
  { key: "utility", label: "Utility" },
  { key: "errand_liaison", label: "Errand & Liaison" },
];

export function CollectionForm({
  date,
  unitOptions,
  onDone,
}: {
  date: string;
  unitOptions: UnitOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(createCollection, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="collected_on" value={date} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Category *</label>
          <select name="business_line" defaultValue="rental" className={inputCls}>
            {COLLECTION_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Amount (₱) *</label>
          <input name="amount" type="number" step="0.01" min="0" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>OR number</label>
          <input name="or_number" className={inputCls} placeholder="Official receipt #" />
        </div>
        <div>
          <label className={labelCls}>Payment type</label>
          <select name="payment_type" defaultValue="cash" className={inputCls}>
            {PAYMENT_TYPES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Unit / room (optional)</label>
          <select name="unit_id" defaultValue="" className={inputCls}>
            <option value="">— none —</option>
            {unitOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Collected by (role)</label>
          <select name="collected_by_role" defaultValue={COLLECTED_BY[0].key} className={inputCls}>
            {COLLECTED_BY.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Remarks</label>
          <input name="remarks" className={inputCls} />
        </div>
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
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add collection"}
        </button>
      </div>
    </form>
  );
}
