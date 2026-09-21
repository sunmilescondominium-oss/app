import { requireModule } from "@/lib/auth/dal";
import {
  listExpenseCategories,
  listExpenseVendors,
  listExpenses,
  getExpenseSettings,
  listPettyCashFunds,
} from "@/lib/expenses/queries";
import { listAccountOptions } from "@/lib/banking/queries";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { FloatingCalculator } from "@/components/ui/floating-calculator";
import {
  RecordExpenseForm,
  CategoryForm,
  VendorForm,
  ExpenseSettingsForm,
  CsvImportPanel,
  PettyCashFundForm,
  LoadFundForm,
} from "@/components/expenses/expense-forms";
import { ExpenseTable } from "@/components/expenses/expense-table";

export const metadata = { title: "General Expenses" };

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const APPROVER_ROLES = ["admin", "accounting", "managing_officer"];

export default async function ExpensesPage() {
  const user = await requireModule("expenses");
  const canWrite = user.roleKeys.some((r) => ["admin", "accounting"].includes(r));
  const canApprove = user.roleKeys.some((r) => APPROVER_ROLES.includes(r));

  const [categories, vendors, expenses, settings, accounts, funds] = await Promise.all([
    listExpenseCategories(),
    listExpenseVendors(),
    listExpenses(),
    getExpenseSettings(),
    canWrite ? listAccountOptions() : Promise.resolve([]),
    listPettyCashFunds(),
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
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

      {/* Petty cash fund balances */}
      {funds.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {funds.filter((f) => f.is_active).map((f) => (
            <div
              key={f.id}
              className={`rounded-xl border p-3 ${
                f.balance <= f.low_balance_threshold
                  ? "border-rose-200 bg-rose-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <p className="text-xs font-medium text-stone-600">{f.name}</p>
              <p className={`text-lg font-bold tabular-nums ${f.balance <= f.low_balance_threshold ? "text-rose-700" : "text-emerald-800"}`}>
                {peso(f.balance)}
              </p>
              {f.balance <= f.low_balance_threshold && (
                <p className="text-xs text-rose-500">Low balance</p>
              )}
            </div>
          ))}
        </div>
      )}

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
              funds={funds}
            />
          </div>
        </details>
      )}

      {/* Expense list */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">All expenses</h2>
      <ExpenseTable
        expenses={expenses}
        categories={categories}
        vendors={vendors}
        canWrite={canWrite}
        canApprove={canApprove}
      />

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
            <summary className="cursor-pointer text-sm font-semibold text-stone-700">Petty cash funds ({funds.length})</summary>
            <div className="mt-4 space-y-4">
              <p className="text-xs text-stone-500">Create and manage petty cash funds. Each fund tracks its own balance via load and disbursement transactions.</p>
              <PettyCashFundForm />
              <div className="divide-y divide-stone-100">
                {funds.map((f) => (
                  <div key={f.id} className="py-3">
                    <p className="mb-2 text-xs font-medium text-stone-600">
                      {f.name} &nbsp;·&nbsp; Balance: <span className="tabular-nums font-bold">{peso(f.balance)}</span>
                      {!f.is_active && <span className="ml-2 text-rose-400">(inactive)</span>}
                    </p>
                    <PettyCashFundForm fund={f} />
                  </div>
                ))}
              </div>
              <div className="border-t border-stone-100 pt-4">
                <p className="mb-2 text-xs font-semibold text-stone-600">Replenish / load a fund</p>
                <LoadFundForm funds={funds} accounts={accounts} />
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
      <FloatingCalculator />
    </>
  );
}
