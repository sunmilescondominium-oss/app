import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import {
  salesReport,
  plReport,
  monthlyCompare,
  listExpenses,
  getFinanceSettings,
} from "@/lib/finance/queries";
import { todayManila, peso } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ExpensePanel } from "@/components/finance/expense-panel";
import { VatSettings } from "@/components/finance/vat-settings";

export const metadata = { title: "P&L / Reports" };

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("finance");
  const canWrite = canWriteModule(user.roleKeys, "finance");

  const sp = await searchParams;
  const from = (typeof sp.from === "string" && sp.from) || monthStart();
  const to = (typeof sp.to === "string" && sp.to) || todayManila();

  const [sales, pl, monthly, expenses, settings] = await Promise.all([
    salesReport(from, to),
    plReport(from, to),
    monthlyCompare(6),
    listExpenses(from, to),
    getFinanceSettings(),
  ]);

  const inputCls =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <PageHeader title="P&L / Reports" subtitle={`${from} to ${to}`} />
        <PrintButton label="Print report" />
      </div>

      <div className="mb-4 hidden border-b border-slate-300 pb-3 print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Sales & P&L Report — {from} to {to}</p>
      </div>

      <form method="get" className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input type="date" name="from" defaultValue={from} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input type="date" name="to" defaultValue={to} className={inputCls} />
        </div>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900">
          Apply
        </button>
      </form>

      {canWrite && (
        <div className="mb-6">
          <VatSettings settings={settings} />
        </div>
      )}

      {/* Sales report */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sales (income)</h2>
      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Business line</th>
              <th className="px-4 py-3 text-right">Gross sales</th>
            </tr>
          </thead>
          <tbody>
            {sales.rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-500">No sales in this range.</td>
              </tr>
            )}
            {sales.rows.map((r) => (
              <tr key={r.line} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.gross)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold">
              <td className="px-4 py-3">Gross total</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(sales.grossTotal)}</td>
            </tr>
            {sales.vatMode !== "none" && (
              <>
                <tr className="text-slate-600">
                  <td className="px-4 py-1.5">VATable / net</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{peso(sales.net)}</td>
                </tr>
                <tr className="text-slate-600">
                  <td className="px-4 py-1.5">{sales.vatLabel}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{peso(sales.vat)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      {/* P&L */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Profit &amp; Loss by business line</h2>
      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expense</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {pl.rows.map((r) => (
              <tr key={r.line} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.income)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.expense)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${r.net < 0 ? "text-red-700" : "text-emerald-700"}`}>{peso(r.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(pl.incomeTotal)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(pl.expenseTotal)}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${pl.netTotal < 0 ? "text-red-700" : "text-emerald-700"}`}>{peso(pl.netTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Monthly compare */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Last 6 months</h2>
      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expense</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">{m.month}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(m.income)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(m.expense)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${m.net < 0 ? "text-red-700" : "text-emerald-700"}`}>{peso(m.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expenses */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Expenses</h2>
      <ExpensePanel expenses={expenses} canWrite={canWrite} />
    </>
  );
}
