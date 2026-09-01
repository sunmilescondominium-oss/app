import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import {
  salesReport,
  plReportFull,
  monthlyCompare,
  listExpenses,
  expenseByCategory,
  getFinanceSettings,
} from "@/lib/finance/queries";
import { presetDates, priorDates, formatPeriodLabel, type PeriodPreset, type CompareMode } from "@/lib/finance/periods";
import { peso } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ExpensePanel } from "@/components/finance/expense-panel";
import { VatSettings } from "@/components/finance/vat-settings";
import { PeriodFilter } from "@/components/finance/period-filter";
import { SalesByLineChart, MonthlyChart } from "@/components/finance/charts";

export const metadata = { title: "P&L / Reports" };

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleString("en-PH", { month: "short", year: "numeric" });
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("finance");
  const canWrite = canWriteModule(user.roleKeys, "finance");

  const sp = await searchParams;
  const preset = ((sp.preset as string) || "month") as PeriodPreset;
  const compare = ((sp.compare as string) || "none") as CompareMode;
  const months = Math.min(12, Math.max(1, Number(sp.months) || 6));

  let from: string;
  let to: string;
  if (preset === "custom") {
    const today = presetDates("today")[0];
    from = (typeof sp.from === "string" && sp.from) || today;
    to = (typeof sp.to === "string" && sp.to) || today;
  } else {
    [from, to] = presetDates(preset);
  }

  const prior = priorDates(from, to, compare);
  const priorFrom = prior?.[0];
  const priorTo = prior?.[1];

  const [sales, pl, monthly, expenses, expByCat, settings] = await Promise.all([
    salesReport(from, to),
    plReportFull(from, to, priorFrom, priorTo),
    monthlyCompare(months),
    listExpenses(from, to),
    expenseByCategory(from, to),
    getFinanceSettings(),
  ]);

  const periodLabel = formatPeriodLabel(from, to);
  const priorLabel = prior ? formatPeriodLabel(prior[0], prior[1]) : null;

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <PageHeader backHref="/dashboard" title="P&L / Reports" subtitle={periodLabel} />
        <PrintButton label="Print report" />
      </div>

      <div className="mb-4 hidden border-b border-stone-300 pb-3 print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Sales & P&L Report — {periodLabel}</p>
      </div>

      <PeriodFilter from={from} to={to} preset={preset} compare={compare} months={months} />

      {priorLabel && (
        <p className="no-print mb-3 text-xs text-stone-500">
          Compared to: <span className="font-medium text-stone-700">{priorLabel}</span>
        </p>
      )}

      {/* KPI tiles */}
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Revenue", value: pl.incomeTotal, prior: pl.priorIncomeTotal, delta: pl.deltaNet, note: null },
          { label: "Expenses", value: pl.expenseTotal, prior: pl.priorExpenseTotal, delta: pl.deltaNet, note: null },
          {
            label: "Net Profit",
            value: pl.netTotal,
            prior: pl.priorNetTotal,
            delta: pl.deltaNet,
            note: `${pl.margin.toFixed(1)}% margin`,
          },
        ].map(({ label, value, prior: prVal, note }, i) => {
          const d = pl.hasPrior ? value - prVal : 0;
          const dpct = pl.hasPrior && prVal !== 0 ? ((d / Math.abs(prVal)) * 100).toFixed(1) : null;
          const negative = value < 0;
          return (
            <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
              <p className={`text-2xl font-bold tabular-nums ${negative ? "text-red-700" : "text-stone-900"}`}>
                {peso(value)}
              </p>
              {note && <p className="mt-0.5 text-xs text-stone-400">{note}</p>}
              {pl.hasPrior && (
                <p className={`mt-1.5 text-xs tabular-nums ${d > 0 ? "text-emerald-600" : d < 0 ? "text-red-600" : "text-stone-400"}`}>
                  {d > 0 ? "▲" : d < 0 ? "▼" : "="} {peso(Math.abs(d))}
                  {dpct !== null && ` (${d >= 0 ? "+" : ""}${dpct}%)`}
                  <span className="text-stone-400"> vs prior</span>
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* Charts */}
      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-stone-800">Sales by business line</p>
          <SalesByLineChart rows={sales.rows} />
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-stone-800">Income vs expense — last {months} months</p>
          <MonthlyChart points={monthly} />
        </div>
      </section>

      {/* Sales report */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Sales (income)</h2>
      <div className="mb-6 table-wrap">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Business line</th>
              <th className="px-4 py-3 text-right">Gross sales</th>
            </tr>
          </thead>
          <tbody>
            {sales.rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-stone-500">No sales in this range.</td>
              </tr>
            )}
            {sales.rows.map((r) => (
              <tr key={r.line} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.gross)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-semibold">
              <td className="px-4 py-3">Gross total</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(sales.grossTotal)}</td>
            </tr>
            {sales.vatMode !== "none" && (
              <>
                <tr className="text-stone-600">
                  <td className="px-4 py-1.5">VATable / net</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{peso(sales.net)}</td>
                </tr>
                <tr className="text-stone-600">
                  <td className="px-4 py-1.5">{sales.vatLabel}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{peso(sales.vat)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      {/* P&L with comparison */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Profit &amp; Loss by business line</h2>
      <div className="mb-6 table-wrap">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expense</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-right">Margin</th>
              {pl.hasPrior && (
                <>
                  <th className="px-4 py-3 text-right">Prior net</th>
                  <th className="px-4 py-3 text-right">Δ ₱</th>
                  <th className="px-4 py-3 text-right">Δ %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {pl.rows.map((r) => (
              <tr key={r.line} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.income)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.expense)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${r.net < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {peso(r.net)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">
                  {r.income > 0 ? `${r.margin.toFixed(1)}%` : "—"}
                </td>
                {pl.hasPrior && (
                  <>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">{peso(r.priorNet)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${r.deltaNet > 0 ? "text-emerald-600" : r.deltaNet < 0 ? "text-red-600" : "text-stone-400"}`}>
                      {r.deltaNet > 0 ? "+" : ""}{peso(r.deltaNet)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${r.deltaNet > 0 ? "text-emerald-600" : r.deltaNet < 0 ? "text-red-600" : "text-stone-400"}`}>
                      {pct(r.deltaNetPct)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(pl.incomeTotal)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(pl.expenseTotal)}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${pl.netTotal < 0 ? "text-red-700" : "text-emerald-700"}`}>
                {peso(pl.netTotal)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-stone-500">
                {pl.incomeTotal > 0 ? `${pl.margin.toFixed(1)}%` : "—"}
              </td>
              {pl.hasPrior && (
                <>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-500">{peso(pl.priorNetTotal)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${pl.deltaNet > 0 ? "text-emerald-600" : pl.deltaNet < 0 ? "text-red-600" : "text-stone-400"}`}>
                    {pl.deltaNet > 0 ? "+" : ""}{peso(pl.deltaNet)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${pl.deltaNet > 0 ? "text-emerald-600" : pl.deltaNet < 0 ? "text-red-600" : "text-stone-400"}`}>
                    {pct(pl.deltaNetPct)}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Monthly trend */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Monthly trend — last {months} months</h2>
      <div className="mb-6 table-wrap">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3 text-right">Income</th>
              <th className="px-4 py-3 text-right">Expense</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{monthLabel(m.month)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(m.income)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(m.expense)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${m.net < 0 ? "text-red-700" : "text-emerald-700"}`}>{peso(m.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expense by category */}
      {expByCat.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Expenses by category</h2>
          <div className="mb-6 table-wrap">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Count</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">% of expenses</th>
                </tr>
              </thead>
              <tbody>
                {expByCat.map((c) => (
                  <tr key={c.category} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5">{c.category || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">{c.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{peso(c.total)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, c.pct)}%` }} />
                        </div>
                        {c.pct.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Export controls */}
      <div className="no-print mb-6 flex gap-2">
        <a href={`/api/export/finance-pl?from=${from}&to=${to}`} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
          ⬇ Export to Sheets
        </a>
        <a href={`/api/finance/bir-export?from=${from}&to=${to}`} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100">
          ⬇ BIR CSV
        </a>
      </div>

      {canWrite && (
        <div className="mb-6">
          <VatSettings settings={settings} />
        </div>
      )}

      {/* Expenses detail */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Expense entries</h2>
      <ExpensePanel expenses={expenses} canWrite={canWrite} />
    </>
  );
}
