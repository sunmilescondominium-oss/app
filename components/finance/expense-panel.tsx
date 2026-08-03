"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createExpense, deleteExpense, type ActionResult } from "@/app/(app)/finance/actions";
import { COLLECTION_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/config";
import { peso, todayManila } from "@/lib/collections/summary";
import type { Expense } from "@/lib/finance/types";

const LINE = Object.fromEntries(COLLECTION_CATEGORIES.map((c) => [c.key, c.label]));
const inputCls =
  "rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function ExpensePanel({ expenses, canWrite }: { expenses: Expense[]; canWrite: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(createExpense, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  async function del(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const r = await deleteExpense(id);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {canWrite && (
        <form action={action} className="no-print mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
          <select name="business_line" defaultValue="hotel" className={inputCls}>
            {COLLECTION_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select name="category" defaultValue="Utilities" className={inputCls}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input name="amount" type="number" step="0.01" min="0" placeholder="Amount" className={`${inputCls} w-28`} />
          <input name="expense_date" type="date" defaultValue={todayManila()} className={inputCls} />
          <input name="vendor" placeholder="Vendor" className={inputCls} />
          <input name="or_number" placeholder="OR #" className={`${inputCls} w-24`} />
          <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            Add expense
          </button>
          {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3 text-right">Amount</th>
              {canWrite && <th className="no-print px-4 py-3 text-right">·</th>}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-stone-500">
                  No expenses in this range.
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{e.expense_date}</td>
                <td className="px-4 py-2.5">{LINE[e.business_line] ?? e.business_line}</td>
                <td className="px-4 py-2.5">{e.category}</td>
                <td className="px-4 py-2.5 text-stone-500">{e.vendor ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(e.amount)}</td>
                {canWrite && (
                  <td className="no-print px-4 py-2.5 text-right">
                    <button type="button" onClick={() => del(e.id)} className="text-xs font-medium text-red-600 hover:underline">
                      delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
