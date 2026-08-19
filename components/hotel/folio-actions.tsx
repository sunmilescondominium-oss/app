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

const SHORT_STAY_MS = 30 * 60 * 1000; // 30 minutes

export function FolioActions({
  stayId,
  status,
  balance,
  checkInAt,
  suggestedArNo,
}: {
  stayId: string;
  status: string;
  balance: number;
  checkInAt?: string;
  suggestedArNo?: string;
}) {
  const router = useRouter();
  const [payState, payAction, payPending] = useActionState<ActionResult | undefined, FormData>(
    recordStayPayment.bind(null, stayId),
    undefined,
  );
  const [hours, setHours] = useState(1);
  const [busy, setBusy] = useState(false);

  // Short-stay checkout prompt state
  const [shortPrompt, setShortPrompt] = useState(false);
  const [earlyReason, setEarlyReason] = useState("");
  const [checkoutErr, setCheckoutErr] = useState("");

  useEffect(() => {
    if (payState?.ok) router.refresh();
  }, [payState, router]);

  const active = status === "active";
  const showPayment = active || balance > 0;
  if (!showPayment) return null;

  function isShortStay() {
    if (!checkInAt) return false;
    return Date.now() - new Date(checkInAt).getTime() < SHORT_STAY_MS;
  }

  async function extend() {
    if (hours <= 0) return;
    setBusy(true);
    const r = await extendStay(stayId, hours);
    setBusy(false);
    if (!r.ok) { window.alert(r.error); return; }
    router.refresh();
  }

  async function doCheckout() {
    if (isShortStay()) { setShortPrompt(true); return; }
    const msg = balance > 0 ? `Balance is ${peso(balance)}. Check out anyway?` : "Check out this guest?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    const r = await checkOut(stayId);
    setBusy(false);
    if (!r.ok) { setCheckoutErr(r.error); return; }
    router.refresh();
  }

  async function voidAsTest() {
    if (!window.confirm("Mark this as a TEST check-in? The stay will be voided with no housekeeping task.")) return;
    setBusy(true); setCheckoutErr("");
    const r = await checkOut(stayId, "test");
    setBusy(false);
    if (!r.ok) { setCheckoutErr(r.error); return; }
    router.refresh();
  }

  async function earlyCheckout() {
    if (!earlyReason.trim()) { setCheckoutErr("Please enter a reason for the early checkout."); return; }
    setBusy(true); setCheckoutErr("");
    const r = await checkOut(stayId, "early", earlyReason);
    setBusy(false);
    if (!r.ok) { setCheckoutErr(r.error); return; }
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
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Amount</label>
          <input name="amount" type="number" step="0.01" min="0" className={`${inputCls} w-28`} />
        </div>
        <div>
          <label className={labelCls}>AR No</label>
          <input name="ar_no" defaultValue={suggestedArNo ?? ""} placeholder={suggestedArNo ?? "e.g. AR-002384"} className={`${inputCls} w-32`} />
        </div>
        <div>
          <label className={labelCls}>OR No (optional)</label>
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

      {active && !shortPrompt && (
        <button
          type="button"
          onClick={doCheckout}
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Check out
        </button>
      )}

      {/* Short-stay prompt (< 30 min) */}
      {shortPrompt && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-900">⚠ This guest has been here less than 30 minutes.</p>
          <p className="text-xs text-amber-800">Was this a system test or a real early checkout?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={voidAsTest}
              disabled={busy}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
            >
              🧪 Test — void this check-in
            </button>
            <div className="space-y-1">
              <input
                value={earlyReason}
                onChange={(e) => setEarlyReason(e.target.value)}
                placeholder="Reason for early checkout"
                className={`${inputCls} text-xs`}
              />
              <button
                type="button"
                onClick={earlyCheckout}
                disabled={busy}
                className="w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Real early checkout
              </button>
            </div>
          </div>
          {checkoutErr && <p className="text-xs text-red-600">{checkoutErr}</p>}
          <button type="button" onClick={() => { setShortPrompt(false); setCheckoutErr(""); }}
            className="text-xs text-stone-500 hover:underline">
            Cancel
          </button>
        </div>
      )}

      {checkoutErr && !shortPrompt && <p className="text-sm text-red-600">{checkoutErr}</p>}
    </div>
  );
}
