import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { payrollReport, staffPayList } from "@/lib/hr/queries";
import { todayManila, peso } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { PayPanel } from "@/components/hr/pay-panel";

export const metadata = { title: "HR / Payroll" };

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("hr");
  const canWrite = canWriteModule(user.roleKeys, "hr");

  const sp = await searchParams;
  const from = (typeof sp.from === "string" && sp.from) || monthStart();
  const to = (typeof sp.to === "string" && sp.to) || todayManila();

  const [report, payList] = await Promise.all([payrollReport(from, to), canWrite ? staffPayList() : Promise.resolve([])]);

  const inputCls =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <PageHeader title="HR / Payroll" subtitle={`DTR & payroll · ${from} to ${to}`} />
        <PrintButton label="Print DTR" />
      </div>

      <div className="mb-4 hidden border-b border-slate-300 pb-3 print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Daily Time Record & Payroll Summary — {from} to {to}</p>
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

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">DTR & payroll</h2>
      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3 text-right">Days</th>
              <th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3 text-right">Rate/hr</th>
              <th className="px-4 py-3 text-right">Gross pay</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No completed time records in this range.</td>
              </tr>
            )}
            {report.rows.map((r) => (
              <tr key={r.userId} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.days}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.hours.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.hourlyRate ? peso(r.hourlyRate) : <span className="text-amber-600">set rate</span>}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.gross)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right tabular-nums">{report.hoursTotal.toFixed(2)}</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right tabular-nums">{peso(report.grossTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {canWrite && (
        <>
          <h2 className="no-print mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Hourly rates</h2>
          <PayPanel rows={payList} />
          <p className="no-print mt-2 text-xs text-slate-400">Rates feed the gross-pay column. Confirm final payroll figures with accounting.</p>
        </>
      )}
    </>
  );
}
