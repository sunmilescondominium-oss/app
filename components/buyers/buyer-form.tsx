"use client";

import { useActionState, useEffect } from "react";
import {
  createBuyer,
  updateBuyer,
  type ActionResult,
} from "@/app/(app)/buyers/actions";
import { PAYMENT_SCHEMES } from "@/lib/config";
import type { Buyer } from "@/lib/buyers/types";
import type { UnitOption } from "@/lib/collections/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

export function BuyerForm({
  mode,
  buyer,
  unitOptions,
  onDone,
}: {
  mode: "create" | "edit";
  buyer?: Buyer;
  unitOptions: UnitOption[];
  onDone: () => void;
}) {
  const action =
    mode === "edit" && buyer ? updateBuyer.bind(null, buyer.id) : createBuyer;
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Unit</label>
          <select name="unit_id" defaultValue={buyer?.unit_id ?? ""} className={inputCls}>
            <option value="">— none —</option>
            {unitOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Contact label</label>
          <input name="contact_label" defaultValue={buyer?.contact_label ?? ""} className={inputCls} placeholder="e.g. Buyer 5B" />
        </div>
        <div>
          <label className={labelCls}>Reference PIN</label>
          <input name="ref_pin" defaultValue={buyer?.ref_pin ?? ""} className={inputCls} placeholder={mode === "create" ? "blank = auto-generate" : ""} />
        </div>
        <div>
          <label className={labelCls}>Payment scheme *</label>
          <select name="payment_scheme" defaultValue={buyer?.payment_scheme ?? "fixed"} className={inputCls}>
            {PAYMENT_SCHEMES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>TCP (₱)</label>
          <input name="tcp" type="number" step="0.01" defaultValue={buyer?.tcp ?? ""} className={inputCls} placeholder="blank = use unit TCP" />
        </div>
        <div>
          <label className={labelCls}>Down payment (₱)</label>
          <input name="downpayment" type="number" step="0.01" defaultValue={buyer?.downpayment ?? 0} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Term (months)</label>
          <input name="term_months" type="number" defaultValue={buyer?.term_months ?? 60} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Annual interest rate</label>
          <input name="annual_interest_rate" type="number" step="0.0001" defaultValue={buyer?.annual_interest_rate ?? ""} className={inputCls} placeholder="e.g. 0.10 — blank = default" />
        </div>
        <div>
          <label className={labelCls}>Start date</label>
          <input name="start_date" type="date" defaultValue={buyer?.start_date ?? ""} className={inputCls} />
        </div>
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Saving…" : mode === "edit" ? "Save & recompute" : "Add buyer"}
        </button>
      </div>
    </form>
  );
}
