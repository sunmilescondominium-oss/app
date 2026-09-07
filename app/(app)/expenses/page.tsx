import { requireModule } from "@/lib/auth/dal";
import {
  listExpenseCategories,
  listExpenseVendors,
  listExpenses,
  getExpenseSettings,
} from "@/lib/expenses/queries";
import { listAccountOptions } from "@/lib/banking/queries";
import { PageHeader, Breadcrumb } from "@/components/ui";
import {
  RecordExpenseForm,
  CategoryForm,
  VendorForm,
  ExpenseSettingsForm,
  CsvImportPanel,
} from "@/components/expenses/expense-forms";

export const metadata = { title: "General Expenses" };

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_CLS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending:  "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-700",
};

export default async function ExpensesPage() {
  const user = await requireModule("expenses");
  const canWrite = user.roleKeys.some((r) => ["admin", "accounting"].includes(r));

  const [categories, vendors, expenses, settings, accounts] = await Promise.all([
    listExpenseCategories(),
    listExpenseVendors(),
    listExpenses(),
    getExpenseSettings(),
    canWrite ? listAccountOptions() : Promise.resolve([]),
  ]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "General Expenses" }]} />
      <PageHeader
        title="General Expenses"
        subtitle="Record and track admin & operational expenses drawn from bank or petty cash."
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">Total (all time)</p>
          <p className="text-lg font-bold tabular-nums text-stone-900">{peso(total)}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">Entries</p>
          <p className="text-lg font-bold tabular-nums text-stone-900">{expenses.length}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">Pending approval</p>
          <p className="text-lg font-bold tabular-nums text-amber-800">
            {expenses.filter((e) => e.approval_status === "pending").length}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">Petty cash expenses</p>
          <p className="text-lg font-bold tabular-nums text-stone-900">
            {expenses.filter((e) => e.source === "petty_cash").length}
          </p>
        </div>
      </div>

      {/* Record new expense */}
      {canWrite && (
        <details className="mb-4 rounded-2xl border border-stone-200 bg-white p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-emerald-700">Record new expense</summary>
          <div className="mt-4">
            <RecordExpenseForm
              categories={categories}
              vendors={vendors}
              accounts={accounts}
              settings={settings}
            />
          </div>
        </details>
      )}

      {/* Expense list */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">All expenses</h2>
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
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-stone-500">No expenses recorded yet.</td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5 text-stone-500">{e.expense_date}</td>
                <td className="px-4 py-2.5">
                  {e.description}
                  {e.remarks && <span className="block text-xs text-stone-400">{e.remarks}</span>}
                </td>
                <td className="px-4 py-2.5 text-stone-600">{e.category_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">{e.vendor_name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {e.source === "bank" ? (e.bank_account_label ?? "Bank") : e.source === "petty_cash" ? "Petty Cash" : "Import"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-rose-700">{peso(e.amount)}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[e.approval_status] ?? ""}`}>
                    {e.approval_status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-stone-500">{e.or_number ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Settings tabs — admin/accounting only */}
      {canWrite && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Settings</h2>

          <details className="mb-3 rounded-2xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-stone-700">Categories ({categories.length})</summary>
            <div className="mt-4 space-y-4">
              <CategoryForm />
              <div className="divide-y divide-stone-100">
                {categories.map((c) => (
                  <div key={c.id} className="py-3">
                    <p className="mb-2 text-xs text-stone-500">{c.name} {!c.is_active && <span className="text-rose-400">(inactive)</span>}</p>
                    <CategoryForm category={c} />
                  </div>
                ))}
              </div>
            </div>
          </details>

          <details className="mb-3 rounded-2xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-stone-700">Vendors / Payees ({vendors.length})</summary>
            <div className="mt-4 space-y-4">
              <VendorForm />
              <div className="divide-y divide-stone-100">
                {vendors.map((v) => (
                  <div key={v.id} className="py-3">
                    <p className="mb-2 text-xs text-stone-500">{v.name} {v.tin && `· TIN ${v.tin}`}</p>
                    <VendorForm vendor={v} />
                  </div>
                ))}
              </div>
            </div>
          </details>

          <details className="mb-3 rounded-2xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-stone-700">Approval settings</summary>
            <div className="mt-4">
              <ExpenseSettingsForm settings={settings} />
            </div>
          </details>

          <details className="mb-3 rounded-2xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-stone-700">Import historical expenses (CSV)</summary>
            <div className="mt-4">
              <CsvImportPanel categories={categories} vendors={vendors} accounts={accounts} />
            </div>
          </details>
        </>
      )}
    </>
  );
}
