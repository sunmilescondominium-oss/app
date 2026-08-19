"use client";

import { useRef, useState, useTransition } from "react";
import { submitShiftHandover } from "@/app/(app)/hotel/actions";
import { DenominationCounter } from "@/components/transmittals/denomination-counter";
import { peso } from "@/lib/collections/summary";
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
  const [state, setState] = useState<ActionResult | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState<number | null>(null);
  const [denomTotal, setDenomTotal] = useState(0);
  const pendingFd = useRef<FormData | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    pendingFd.current = fd;
    const counted = fd.get("counted_amount");
    setEnteredAmount(counted && String(counted).trim() !== "" ? Number(counted) : null);
    setConfirming(true);
  }

  function doSubmit() {
    if (!pendingFd.current) return;
    const fd = pendingFd.current;
    startTransition(async () => {
      const res = await submitShiftHandover(undefined, fd);
      setState(res);
      if (!res?.ok) setConfirming(false);
    });
  }

  if (existing) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 text-lg">✓</span>
          <p className="text-sm font-semibold text-emerald-900">
            Shift bag handed over{existing.cashier_absent ? " (cashier absent — monitoring covered)" : ""}
          </p>
        </div>
        <p className="text-xs text-emerald-700">
          {new Date(existing.handed_over_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
        </p>
        {existing.counted_amount != null && (
          <p className="text-xs text-emerald-700">Cashier count: ₱{existing.counted_amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
        )}
        {existing.counted_amount == null && (
          <p className="text-xs text-amber-700">Cashier did not count — monitoring must count the bag.</p>
        )}
        {existing.remarks && <p className="text-xs text-stone-500">Remarks: {existing.remarks}</p>}
      </div>
    );
  }

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">✓ Shift handover submitted. Hotel &amp; Rental Monitoring has been notified.</p>
      </div>
    );
  }

  // --- Confirm panel ---
  if (confirming) {
    const denomVariance = enteredAmount != null ? Math.round((denomTotal - enteredAmount) * 100) / 100 : 0;
    const hasDenomMismatch = enteredAmount != null && denomTotal > 0 && denomVariance !== 0;

    return (
      <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-4">
        <p className="text-sm font-semibold text-stone-800">
          Confirm: {isMonitoring ? "Record bag received" : "Submit shift bag handover"}
        </p>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Date</span>
            <span className="font-medium">{date}</span>
          </div>
          {enteredAmount != null && (
            <div className="flex justify-between">
              <span className="text-stone-500">Amount counted</span>
              <span className="tabular-nums font-medium">{peso(enteredAmount)}</span>
            </div>
          )}
          {enteredAmount == null && (
            <div className="flex justify-between">
              <span className="text-stone-500">Amount counted</span>
              <span className="text-stone-400 italic">not entered</span>
            </div>
          )}
          {denomTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-500">Denomination total</span>
              <span className="tabular-nums font-medium">{peso(denomTotal)}</span>
            </div>
          )}
          {hasDenomMismatch && (
            <div className={`flex justify-between border-t pt-1.5 font-semibold ${denomVariance < 0 ? "text-rose-700" : "text-amber-700"}`}>
              <span>{denomVariance < 0 ? "⚠ Denomination short of entered amount" : "⚠ Denomination over entered amount"}</span>
              <span className="tabular-nums">{peso(Math.abs(denomVariance))}</span>
            </div>
          )}
        </div>

        {hasDenomMismatch && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your denomination total ({peso(denomTotal)}) does not match your entered amount ({peso(enteredAmount!)}). Please verify before proceeding.
          </div>
        )}

        {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={pending}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60">
            ← Edit
          </button>
          <button type="button" onClick={doSubmit} disabled={pending}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${hasDenomMismatch ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}>
            {pending ? "Submitting…" : hasDenomMismatch ? "Submit with discrepancy" : isMonitoring ? "Confirm — Record bag received" : "Confirm — Submit handover"}
          </button>
        </div>
      </div>
    );
  }

  // --- Main form ---
  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
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
        <label className={labelCls}>Amount counted (optional — leave blank if not counted)</label>
        <input name="counted_amount" type="number" step="0.01" min="0" placeholder="0.00" className={inputCls} />
        <p className="mt-1 text-xs text-stone-400">
          {isMonitoring
            ? "This is the cashier's count for reference. You will do the authoritative count below."
            : "Optional. Monitoring will do the authoritative count. Enter yours if you counted."}
        </p>
      </div>

      <DenominationCounter onTotalChange={setDenomTotal} />

      <div>
        <label className={labelCls}>Remarks</label>
        <input name="remarks" className={inputCls} placeholder="Optional notes" />
      </div>

      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button type="submit"
        className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700">
        Review &amp; {isMonitoring ? "Record bag received" : "Confirm shift bag handover"}
      </button>
    </form>
  );
}
