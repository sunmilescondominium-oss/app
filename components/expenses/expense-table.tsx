"use client";

import { useState } from "react";
import { EditExpenseModal, ExpenseApprovalButtons } from "@/components/expenses/expense-forms";
import type { Expense, ExpenseCategory, ExpenseVendor } from "@/lib/expenses/queries";

const STATUS_CLS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending:  "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-700",
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  expenses: Expense[];
  categories: ExpenseCategory[];
  vendors: ExpenseVendor[];
  canWrite: boolean;
  canApprove: boolean;
}

export function ExpenseTable({ expenses, categories, vendors, canWrite, canApprove }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingExpense = expenses.find((e) => e.id === editingId) ?? null;

  return (
    <>
      {editingExpense && canWrite && (
        <EditExpenseModal
          expense={editingExpense}
          categories={categories}
          vendors={vendors}
          onClose={() => setEditingId(null)}
        />
      )}

      <div className="table-wrap">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">OR#</th>
              {canApprove && <th className="px-4 py-3">Action</th>}
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={canApprove ? 10 : 9} className="px-4 py-8 text-center text-stone-500">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                <td className="px-4 py-2.5 text-stone-500">{e.expense_date}</td>
                <td className="px-4 py-2.5">
                  {e.description}
                  {e.remarks && <span className="block text-xs text-stone-400">{e.remarks}</span>}
                </td>
                <td className="px-4 py-2.5 text-stone-600">{e.category_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">{e.vendor_name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {e.source === "bank" ? (e.bank_account_label ?? "Bank") : e.source === "petty_cash" ? (e.fund_name ?? "Petty Cash") : "Import"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-rose-700">{peso(e.amount)}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[e.approval_status] ?? ""}`}>
                    {e.approval_status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-stone-500">{e.or_number ?? "—"}</td>
                {canApprove && (
                  <td className="px-4 py-2.5">
                    {e.approval_status === "pending" && <ExpenseApprovalButtons expenseId={e.id} />}
                  </td>
                )}
                <td className="no-print px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setEditingId(e.id)}
                        className="rounded px-1.5 py-1 text-xs text-stone-400 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                        title="Edit expense"
                      >
                        ✏
                      </button>
                    )}
                    <a href={`/expenses/${e.id}`} className="text-xs font-medium text-amber-700 hover:underline whitespace-nowrap">
                      Print →
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
