"use client";

import { useActionState } from "react";
import { lookupRenter, type RenterState } from "@/app/(public)/renter-portal/actions";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function RenterLookup() {
  const [state, action, pending] = useActionState<RenterState, FormData>(lookupRenter, undefined);

  return (
    <div>
      <form action={action} className="space-y-3">
        <input name="unit_number" required placeholder="Unit number" className={inputCls} autoComplete="off" />
        <input name="pin" required type="password" placeholder="PIN" className={inputCls} autoComplete="off" />
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Checking…" : "View my bill"}
        </button>
      </form>

      {state && !state.ok && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      {state?.ok && (
        <div className="mt-5">
          <div className="rounded-xl bg-stone-50 p-4">
            <p className="font-semibold text-stone-800">{state.data.tenant}</p>
            <p className="text-sm text-stone-500">Unit {state.data.unit_number} · {state.data.business_line}</p>
            <p className="mt-1 text-sm text-stone-600">Rent: {peso(state.data.rent)}/{state.data.billing_cycle === "nightly" ? "night" : "mo"}</p>
            <p className="mt-2 text-lg font-bold text-rose-700">Total due: {peso(state.data.totalDue)}</p>
          </div>

          {state.data.dues.some((d) => d.status !== "paid") && (
            <>
              <p className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Outstanding</p>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <tr><th className="py-2">Item</th><th className="py-2">Due</th><th className="py-2 text-right">Amount</th><th className="py-2">Status</th></tr>
                </thead>
                <tbody>
                  {state.data.dues.filter((d) => d.status !== "paid").map((d, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="py-2">{d.category}{d.remarks ? <span className="block text-[11px] text-stone-400">{d.remarks}</span> : null}</td>
                      <td className="py-2 text-stone-500">{d.due_date}</td>
                      <td className="py-2 text-right tabular-nums">{peso(d.amount)}</td>
                      <td className="py-2"><span className={d.status === "waived" ? "text-stone-500" : "text-amber-700"}>{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {state.data.dues.some((d) => d.status === "paid") && (
            <>
              <p className="mt-5 mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Payment history</p>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <tr><th className="py-2">Item</th><th className="py-2">Paid on</th><th className="py-2">AR #</th><th className="py-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {state.data.dues.filter((d) => d.status === "paid").map((d, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="py-2">{d.category}</td>
                      <td className="py-2 text-stone-500">{d.paid_on ?? "—"}</td>
                      <td className="py-2 text-stone-500">{d.ar_no ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">{peso(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {state.data.dues.length === 0 && <p className="mt-4 text-sm text-stone-400">No charges yet.</p>}
          <p className="mt-3 text-xs text-stone-400">Paid items show their acknowledgement receipt number. Contact the office for any discrepancy.</p>
        </div>
      )}
    </div>
  );
}
