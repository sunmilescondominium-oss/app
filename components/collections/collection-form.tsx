"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createCollection,
  type ActionResult,
} from "@/app/(app)/collections/actions";
import { COLLECTION_CATEGORIES, PAYMENT_TYPES } from "@/lib/config";
import type { UnitOption } from "@/lib/collections/types";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

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
  const [paymentType, setPaymentType] = useState("cash");
  const isCash = paymentType === "cash";

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
          <select name="payment_type" value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={inputCls}>
            {PAYMENT_TYPES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Discount (₱)</label>
          <input name="discount_amount" type="number" step="0.01" min="0" defaultValue="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Coupon code</label>
          <input name="coupon_code" className={inputCls} placeholder="Optional" />
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

      {!isCash && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
          <p className="mb-2 text-xs font-semibold text-sky-800">Online / GCash payment proof</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Reference number *</label>
              <input name="reference_no" className={inputCls} placeholder="GCash/bank ref #" />
            </div>
            <div>
              <label className={labelCls}>Proof (screenshot)</label>
              <input name="proof" type="file" accept="image/*" className="w-full text-sm" />
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="payment_confirmed" className="h-4 w-4" />
            I received / verified this online payment.
          </label>
        </div>
      )}

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
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
