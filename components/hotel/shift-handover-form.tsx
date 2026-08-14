"use client";

import { useActionState } from "react";
import { submitShiftHandover } from "@/app/(app)/hotel/actions";
import { DenominationCounter } from "@/components/transmittals/denomination-counter";
import type { ShiftHandover } from "@/lib/hotel/handover";

type ActionResult = { ok: true } | { ok: false; error: string };

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

export function ShiftHandoverForm({
  date,
  existing,
  isMonitoring,
}: {
  date: string;
  existing: ShiftHandover | null;
  isMonitoring: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    submitShiftHandover,
    undefined,
  );

  if (existing) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 text-lg">✓</span>
          <p className="text-sm font-semibold text-emerald-900">
            Shift bag handed over
            {existing.cashier_absent ? " (cashier absent — monitoring covered)" : ""}
          </p>
        </div>
        <p className="text-xs text-emerald-700">
          {new Date(existing.handed_over_at).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        {existing.counted_amount != null && (
          <p className="text-xs text-emerald-700">
            Cashier count: ₱{existing.counted_amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        )}
        {existing.counted_amount == null && (
          <p className="text-xs text-amber-700">Cashier did not count — monitoring must count the bag.</p>
        )}
        {existing.remarks && (
          <p className="text-xs text-stone-500">Remarks: {existing.remarks}</p>
        )}
      </div>
    );
  }

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">
          ✓ Shift handover submitted. Hotel &amp; Rental Monitoring has been notified.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-stone-800">
        {isMonitoring ? "Record bag turnover (monitoring covering)" : "Submit shift bag handover"}
      </p>
      <input type="hidden" name="shift_date" value={date} />

      {isMonitoring && (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="cashier_absent" className="h-4 w-4 accent-amber-600" />
          Cashier was absent — I am taking over the shift handover
        </label>
      )}

      <div>
        <label className={labelCls}>
          Amount counted (optional — leave blank if not counted)
        </label>
        <input
          name="counted_amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-stone-400">
          {isMonitoring
            ? "This is the cashier's count for reference. You will do the authoritative count below."
            : "Optional. Monitoring will do the authoritative count. Enter yours if you counted."}
        </p>
      </div>

      <DenominationCounter />

      <div>
        <label className={labelCls}>Remarks</label>
        <input name="remarks" className={inputCls} placeholder="Optional notes" />
      </div>

      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending
          ? "Submitting…"
          : isMonitoring
          ? "Record bag received"
          : "Confirm shift bag handover"}
      </button>
    </form>
  );
}
