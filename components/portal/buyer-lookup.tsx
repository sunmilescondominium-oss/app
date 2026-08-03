"use client";

import { useActionState } from "react";
import { lookupBuyer, type PortalState } from "@/app/(public)/buyer-portal/actions";
import { peso } from "@/lib/collections/summary";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function BuyerLookup() {
  const [state, action, pending] = useActionState<PortalState, FormData>(
    lookupBuyer,
    undefined,
  );

  return (
    <div className="text-left">
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="unit_number" className="mb-1 block text-sm font-medium text-stone-700">
            Unit number
          </label>
          <input id="unit_number" name="unit_number" required className={inputCls} placeholder="e.g. 5B" />
        </div>
        <div>
          <label htmlFor="ref_pin" className="mb-1 block text-sm font-medium text-stone-700">
            Reference PIN
          </label>
          <input id="ref_pin" name="ref_pin" required className={inputCls} placeholder="6-digit PIN" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Checking…" : "View my account"}
        </button>
      </form>

      {state && !state.ok && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state && state.ok && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-stone-200 p-4">
            <p className="text-sm text-stone-500">
              {state.data.contact_label} · Unit {state.data.unit_number}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-bold tabular-nums text-stone-900">
                  {state.data.contract_balance != null ? peso(state.data.contract_balance) : "—"}
                </p>
                <p className="text-xs text-stone-500">Contract balance</p>
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums text-stone-900">
                  {state.data.amount_due_now != null ? peso(state.data.amount_due_now) : "—"}
                </p>
                <p className="text-xs text-stone-500">Amount due now</p>
              </div>
            </div>
            {state.data.next_due_date && (
              <p className="mt-3 text-sm text-stone-600">
                Next due date: <strong>{state.data.next_due_date}</strong>
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Payment history
            </p>
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Doc</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.payments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-stone-500">
                        No payments recorded yet.
                      </td>
                    </tr>
                  )}
                  {state.data.payments.map((p, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-3 py-2">{p.paid_on}</td>
                      <td className="px-3 py-2">{p.doc_type}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{peso(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
