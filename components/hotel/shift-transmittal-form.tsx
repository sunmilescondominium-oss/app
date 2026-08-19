"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildHotelShiftTransmittal } from "@/app/(app)/hotel/actions";
import { DenominationCounter } from "@/components/transmittals/denomination-counter";
import { peso } from "@/lib/collections/summary";
import { PAYMENT_TYPES } from "@/lib/config";
import type { ShiftHandover, HotelShiftCollection } from "@/lib/hotel/handover";

type ActionResult = { ok: true; transmittalId?: string } | { ok: false; error: string };

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";
const PAY_LABEL = Object.fromEntries(PAYMENT_TYPES.map((p) => [p.key, p.label]));

export function ShiftTransmittalForm({
  date,
  handover,
  collections,
  itemTypeLabels = {},
}: {
  date: string;
  handover: ShiftHandover | null;
  collections: HotelShiftCollection[];
  itemTypeLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [denomTotal, setDenomTotal] = useState(0);
  const pendingFd = useRef<FormData | null>(null);

  const collectionsTotal = collections.reduce((s, c) => s + c.amount, 0);
  const byMethod = collections.reduce<Record<string, number>>((acc, c) => {
    acc[c.payment_type] = (acc[c.payment_type] ?? 0) + c.amount;
    return acc;
  }, {});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    pendingFd.current = fd;
    setConfirming(true);
  }

  function doSubmit() {
    if (!pendingFd.current) return;
    const fd = pendingFd.current;
    startTransition(async () => {
      const res = await buildHotelShiftTransmittal(undefined, fd);
      setState(res);
      if (res?.ok) router.refresh();
      else setConfirming(false);
    });
  }

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-emerald-900">✓ Hotel shift transmittal built — accounting has been notified.</p>
        {state.transmittalId && (
          <a href={`/transmittals/${state.transmittalId}`} onClick={() => router.refresh()}
            className="text-sm font-medium text-amber-700 hover:underline">
            View transmittal →
          </a>
        )}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="text-sm text-stone-500">No hotel collections recorded for {date} that have not yet been transmitted.</p>
      </div>
    );
  }

  // --- Confirm panel ---
  if (confirming) {
    const variance = Math.round((denomTotal - collectionsTotal) * 100) / 100;
    const hasDiscrepancy = variance !== 0;
    return (
      <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-4">
        <p className="text-sm font-semibold text-stone-800">Confirm: Build hotel shift transmittal — {date}</p>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">System total ({collections.length} collections)</span>
            <span className="tabular-nums font-medium">{peso(collectionsTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Monitoring count (denomination)</span>
            <span className="tabular-nums font-medium">{peso(denomTotal)}</span>
          </div>
          <div className={`flex justify-between border-t pt-1.5 font-semibold ${hasDiscrepancy ? (variance < 0 ? "text-rose-700" : "text-amber-700") : "text-emerald-700"}`}>
            <span>{hasDiscrepancy ? (variance < 0 ? "⚠ Shortage" : "⚠ Overage") : "✓ Exact match"}</span>
            <span className="tabular-nums">{hasDiscrepancy ? peso(Math.abs(variance)) : peso(0)}</span>
          </div>
        </div>

        {hasDiscrepancy && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${variance < 0 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {variance < 0
              ? `Monitoring count is ${peso(Math.abs(variance))} short of the system total. Recount the bag before proceeding, or submit with the discrepancy recorded for accounting to investigate.`
              : `Monitoring count is ${peso(variance)} over the system total. Please verify before proceeding.`}
          </div>
        )}

        {state && !state.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={pending}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60">
            ← Edit
          </button>
          <button type="button" onClick={doSubmit} disabled={pending}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${hasDiscrepancy ? "bg-rose-600 hover:bg-rose-700" : "bg-violet-700 hover:bg-violet-800"}`}>
            {pending ? "Building…" : hasDiscrepancy ? "Submit with discrepancy" : "Confirm & Build transmittal"}
          </button>
        </div>
      </div>
    );
  }

  // --- Main form ---
  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-violet-200 bg-violet-50/30 p-4">
      <div>
        <p className="text-sm font-semibold text-stone-800 mb-1">Count &amp; build hotel shift transmittal — {date}</p>
        <p className="text-xs text-stone-500">Monitoring enters the authoritative cash count. All hotel collections for this date will be bundled.</p>
      </div>

      <input type="hidden" name="shift_date" value={date} />
      {handover && <input type="hidden" name="handover_id" value={handover.id} />}

      {/* Handover reference */}
      {handover && (
        <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 space-y-0.5">
          <p className="font-semibold text-stone-700">Cashier handover reference</p>
          {handover.cashier_name && <p>Cashier: <strong>{handover.cashier_name}</strong></p>}
          {handover.cashier_absent ? (
            <p className="text-amber-700">Cashier was absent — bag taken over by monitoring.</p>
          ) : (
            <>
              <p>Handed over at {new Date(handover.handed_over_at).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })}</p>
              {handover.counted_amount != null ? (
                <div className="flex items-center gap-2">
                  <span>Cashier count: <strong>{peso(handover.counted_amount)}</strong></span>
                  {(() => {
                    const variance = Math.round((handover.counted_amount - collectionsTotal) * 100) / 100;
                    if (variance === 0) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">exact match</span>;
                    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${variance > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{variance > 0 ? `+${peso(variance)} over` : `${peso(variance)} short`}</span>;
                  })()}
                </div>
              ) : <p className="text-amber-600">Cashier did not count.</p>}
              {handover.remarks && <p>Remarks: {handover.remarks}</p>}
            </>
          )}
        </div>
      )}
      {!handover && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No cashier handover recorded for this date. Proceeding without one.
        </div>
      )}

      {/* Collections breakdown */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="border-b border-stone-100 px-4 py-2.5 flex items-center justify-between bg-stone-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Hotel collections to bundle</p>
          <span className="text-xs text-stone-400">{collections.length} entries</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-stone-100 text-stone-400 uppercase">
            <tr>
              <th className="px-4 py-2">Room</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">OR #</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => (
              <tr key={c.id} className="border-t border-stone-50">
                <td className="px-4 py-1.5 font-medium text-stone-700">{c.unit_number ?? "—"}</td>
                <td className="px-4 py-1.5 text-stone-500">{c.charge_type ? (itemTypeLabels[c.charge_type] ?? c.charge_type) : "—"}</td>
                <td className="px-4 py-1.5 font-mono">{c.or_number ?? "—"}</td>
                <td className="px-4 py-1.5">{PAY_LABEL[c.payment_type] ?? c.payment_type}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{peso(c.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-stone-200 font-semibold text-stone-800">
            <tr>
              <td colSpan={4} className="px-4 py-2">Total (system)</td>
              <td className="px-4 py-2 text-right tabular-nums">{peso(collectionsTotal)}</td>
            </tr>
            {Object.entries(byMethod).map(([method, amt]) => (
              <tr key={method} className="text-stone-500 font-normal">
                <td colSpan={4} className="px-4 py-1 text-xs pl-8">{PAY_LABEL[method] ?? method}</td>
                <td className="px-4 py-1 text-right tabular-nums text-xs">{peso(amt)}</td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      {/* Monitoring's authoritative cash count */}
      <div>
        <label className={labelCls}>Monitoring count (authoritative) *</label>
        <DenominationCounter onTotalChange={setDenomTotal} />
        <p className="mt-1.5 text-xs text-stone-400">
          System total: {peso(collectionsTotal)}.{" "}
          {denomTotal > 0 && (
            <span className={Math.round((denomTotal - collectionsTotal) * 100) / 100 !== 0 ? "font-semibold text-rose-600" : "text-emerald-600"}>
              Counted: {peso(denomTotal)} {Math.round((denomTotal - collectionsTotal) * 100) / 100 !== 0 ? `(${Math.round((denomTotal - collectionsTotal) * 100) / 100 > 0 ? "+" : ""}${peso(Math.round((denomTotal - collectionsTotal) * 100) / 100)} variance)` : "— exact match"}
            </span>
          )}
        </p>
      </div>

      <div>
        <label className={labelCls}>Note (optional)</label>
        <input name="note" className={inputCls} placeholder="e.g. short by 50 — cashier advised" />
      </div>

      {state && !state.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <button type="submit"
        className="rounded-lg bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800">
        Review &amp; Build transmittal — {collections.length} collection(s) · {peso(collectionsTotal)}
      </button>
    </form>
  );
}
