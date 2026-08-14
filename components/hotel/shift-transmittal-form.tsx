"use client";

import { useActionState } from "react";
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
}: {
  date: string;
  handover: ShiftHandover | null;
  collections: HotelShiftCollection[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    buildHotelShiftTransmittal,
    undefined,
  );

  const collectionsTotal = collections.reduce((s, c) => s + c.amount, 0);
  const byMethod = collections.reduce<Record<string, number>>((acc, c) => {
    acc[c.payment_type] = (acc[c.payment_type] ?? 0) + c.amount;
    return acc;
  }, {});

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-emerald-900">
          ✓ Hotel shift transmittal built — accounting has been notified.
        </p>
        {state.transmittalId && (
          <a
            href={`/transmittals/${state.transmittalId}`}
            onClick={() => router.refresh()}
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            View transmittal →
          </a>
        )}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="text-sm text-stone-500">
          No hotel collections recorded for {date} that have not yet been transmitted.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-violet-200 bg-violet-50/30 p-4">
      <div>
        <p className="text-sm font-semibold text-stone-800 mb-1">
          Count &amp; build hotel shift transmittal — {date}
        </p>
        <p className="text-xs text-stone-500">
          Monitoring enters the authoritative cash count. All hotel collections for this date will be bundled.
        </p>
      </div>

      <input type="hidden" name="shift_date" value={date} />
      {handover && <input type="hidden" name="handover_id" value={handover.id} />}

      {/* Handover reference */}
      {handover && (
        <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 space-y-0.5">
          <p className="font-semibold text-stone-700">Cashier handover reference</p>
          {handover.cashier_absent ? (
            <p className="text-amber-700">Cashier was absent — bag taken over by monitoring.</p>
          ) : (
            <>
              <p>Handed over at {new Date(handover.handed_over_at).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })}</p>
              {handover.counted_amount != null ? (
                <p>Cashier count: <strong>{peso(handover.counted_amount)}</strong></p>
              ) : (
                <p className="text-amber-600">Cashier did not count.</p>
              )}
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
              <th className="px-4 py-2">OR #</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => (
              <tr key={c.id} className="border-t border-stone-50">
                <td className="px-4 py-1.5 font-medium text-stone-700">{c.unit_number ?? "—"}</td>
                <td className="px-4 py-1.5 font-mono">{c.or_number ?? "—"}</td>
                <td className="px-4 py-1.5">{PAY_LABEL[c.payment_type] ?? c.payment_type}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{peso(c.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-stone-200 font-semibold text-stone-800">
            <tr>
              <td colSpan={3} className="px-4 py-2">Total (system)</td>
              <td className="px-4 py-2 text-right tabular-nums">{peso(collectionsTotal)}</td>
            </tr>
            {Object.entries(byMethod).map(([method, amt]) => (
              <tr key={method} className="text-stone-500 font-normal">
                <td colSpan={3} className="px-4 py-1 text-xs pl-8">{PAY_LABEL[method] ?? method}</td>
                <td className="px-4 py-1 text-right tabular-nums text-xs">{peso(amt)}</td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      {/* Monitoring's authoritative cash count */}
      <div>
        <label className={labelCls}>Monitoring count (authoritative) *</label>
        <DenominationCounter />
        <p className="mt-1.5 text-xs text-stone-400">
          System total: {peso(collectionsTotal)}.
          {handover?.counted_amount != null
            ? ` Cashier counted: ${peso(handover.counted_amount)}.`
            : ""}
          {" "}Any variance will be recorded on the transmittal.
        </p>
      </div>

      <div>
        <label className={labelCls}>Note (optional)</label>
        <input name="note" className={inputCls} placeholder="e.g. short by 50 — cashier advised" />
      </div>

      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
      >
        {pending ? "Building transmittal…" : `Build transmittal — ${collections.length} collection(s) · ${peso(collectionsTotal)}`}
      </button>
    </form>
  );
}
