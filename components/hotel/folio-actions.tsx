"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  extendStay,
  recordStayPayment,
  checkOut,
  type ActionResult,
} from "@/app/(app)/hotel/actions";
import { HOTEL_PAYMENT_METHODS } from "@/lib/config";
import { peso } from "@/lib/collections/summary";

const inputCls =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

export function FolioActions({
  stayId,
  status,
  balance,
}: {
  stayId: string;
  status: string;
  balance: number;
}) {
  const router = useRouter();
  const [payState, payAction, payPending] = useActionState<ActionResult | undefined, FormData>(
    recordStayPayment.bind(null, stayId),
    undefined,
  );
  const [hours, setHours] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (payState?.ok) router.refresh();
  }, [payState, router]);

  const active = status === "active";
  // Keep the payment card available while the guest still owes a balance, even
  // after check-out and until the gate pass is issued/printed.
  const showPayment = active || balance > 0;
  if (!showPayment) return null;

  async function extend() {
    if (hours <= 0) return;
    setBusy(true);
    const r = await extendStay(stayId, hours);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  async function doCheckout() {
    const msg =
      balance > 0 ? `Balance is ${peso(balance)}. Check out anyway?` : "Check out this guest?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    const r = await checkOut(stayId);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="no-print space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
      {!active && balance > 0 && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          Guest checked out — collect the remaining {peso(balance)} to complete before the gate pass is printed.
        </p>
      )}

      {active && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelCls}>Extend by (hours)</label>
            <input
              type="number"
              min={1}
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value, 10) || 1)}
              className={`${inputCls} w-24`}
            />
          </div>
          <button
            type="button"
            onClick={extend}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            Extend
          </button>
        </div>
      )}

      <form action={payAction} className={`flex flex-wrap items-end gap-2 ${active ? "border-t border-stone-100 pt-4" : ""}`}>
        <div>
          <label className={labelCls}>Method</label>
          <select name="method" defaultValue="cash" className={inputCls}>
            {HOTEL_PAYMENT_METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Amount</label>
          <input name="amount" type="number" step="0.01" min="0" className={`${inputCls} w-28`} />
        </div>
        <div>
          <label className={labelCls}>OR # (optional)</label>
          <input name="receipt_no" className={`${inputCls} w-32`} />
        </div>
        <button
          type="submit"
          disabled={payPending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          Record payment
        </button>
        {payState && !payState.ok && <p className="w-full text-sm text-red-700">{payState.error}</p>}
      </form>

      {active && (
        <button
          type="button"
          onClick={doCheckout}
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Check out
        </button>
      )}
    </div>
  );
}
