"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  depositTransmittal,
  reconcileTransmittal,
  returnPassbook,
  markTransmittalPrinted,
  type ActionResult,
} from "@/app/(app)/transmittals/actions";

export function TransmittalActions({
  id,
  status,
  canWrite,
  canReconcile,
  passbookReturned,
}: {
  id: string;
  status: string;
  canWrite: boolean;
  canReconcile: boolean;
  passbookReturned: boolean;
}) {
  const router = useRouter();
  const [depState, depAction, depPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(depositTransmittal.bind(null, id), undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (depState?.ok) router.refresh();
  }, [depState, router]);

  async function reconcile() {
    setBusy(true);
    const res = await reconcileTransmittal(id);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  async function passbook() {
    setBusy(true);
    const res = await returnPassbook(id);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  function print() {
    void markTransmittalPrinted(id);
    window.print();
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={print}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Print for signature
      </button>

      {canWrite && status === "submitted" && (
        <form action={depAction} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Deposit slip ref
            </label>
            <input
              name="deposit_slip_ref"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Amount deposited (₱)</label>
            <input
              name="deposited_amount"
              type="number"
              step="0.01"
              min="0"
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <button
            type="submit"
            disabled={depPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {depPending ? "Saving…" : "Confirm bank deposit"}
          </button>
        </form>
      )}

      {canReconcile && (status === "deposited" || status === "reconciled") && !passbookReturned && (
        <button
          type="button"
          onClick={passbook}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Record passbook returned"}
        </button>
      )}

      {canReconcile && status === "deposited" && (
        <button
          type="button"
          onClick={reconcile}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? "Reconciling…" : "Reconcile slip"}
        </button>
      )}

      {depState && !depState.ok && (
        <p className="w-full text-sm text-red-700">{depState.error}</p>
      )}
      {status === "reconciled" && (
        <p className="text-sm font-medium text-emerald-700">
          ✓ Reconciled — this transmittal is complete.
        </p>
      )}
    </div>
  );
}
