"use client";

import { useActionState, useEffect } from "react";
import { recordPayment, type ActionResult } from "@/app/(app)/buyers/actions";
import { PAYMENT_DOC_TYPES } from "@/lib/config";
import { todayManila } from "@/lib/collections/summary";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

export function PaymentForm({ buyerId, onDone }: { buyerId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(
    recordPayment.bind(null, buyerId),
    undefined,
  );

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Amount (₱) *</label>
          <input name="amount" type="number" step="0.01" min="0" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Document type</label>
          <select name="doc_type" defaultValue="OR" className={inputCls}>
            {PAYMENT_DOC_TYPES.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>OR / receipt number</label>
          <input name="or_number" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Paid on</label>
          <input name="paid_on" type="date" defaultValue={todayManila()} className={inputCls} />
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
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Saving…" : "Record payment"}
        </button>
      </div>
    </form>
  );
}
