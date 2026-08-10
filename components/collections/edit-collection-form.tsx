"use client";

import { useActionState, useEffect } from "react";
import { editCollection } from "@/app/(app)/collections/actions";
import { COLLECTION_CATEGORIES, PAYMENT_TYPES } from "@/lib/config";
import type { Collection } from "@/lib/collections/types";

type ActionResult = { ok: true; pendingId?: string } | { ok: false; error: string };

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

export function EditCollectionForm({ collection, onDone }: { collection: Collection; onDone: () => void }) {
  const action = editCollection.bind(null, collection.id);
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  useEffect(() => {
    // Do NOT auto-close — show the "awaiting approval" state instead.
  }, [state, onDone]);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Correction request submitted</p>
          <p className="mt-1 text-xs text-emerald-700">
            Your request is awaiting approval from a managing officer or consultant.
            The change will be applied only after it is approved. Ref: <span className="font-mono">{state.pendingId?.slice(0, 8).toUpperCase() ?? "—"}</span>
          </p>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {collection.transmittal_id && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          ⚠ This entry was already transmitted. Editing it is a correction and will be recorded.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Category *</label>
          <select name="business_line" defaultValue={collection.business_line} className={inputCls}>
            {COLLECTION_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Amount ₱ *</label>
          <input name="amount" type="number" step="0.01" min="0" defaultValue={collection.amount} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Payment type *</label>
          <select name="payment_type" defaultValue={collection.payment_type} className={inputCls}>
            {PAYMENT_TYPES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>OR / receipt #</label>
          <input name="or_number" defaultValue={collection.or_number ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Collected on</label>
          <input name="collected_on" type="date" defaultValue={collection.collected_on?.slice(0, 10)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Remarks</label>
          <input name="remarks" defaultValue={collection.remarks ?? ""} className={inputCls} />
        </div>
      </div>

      {/* Authorization gate */}
      <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Authorization required</p>
        <div>
          <label className={labelCls}>Justification for this edit *</label>
          <textarea name="justification" required rows={2} placeholder="Why is this correction needed?" className={inputCls} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Employee code *</label>
            <input name="employee_no" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Passcode *</label>
            <input name="passcode" type="password" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Type <span className="font-mono font-semibold">CONFIRM EDIT</span> *</label>
            <input name="confirm_text" required autoComplete="off" placeholder="CONFIRM EDIT" className={inputCls} />
          </div>
        </div>
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save correction"}
        </button>
      </div>
    </form>
  );
}
