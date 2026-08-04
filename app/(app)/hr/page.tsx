import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { payrollReport, staffPayList, getPayrollSettings } from "@/lib/hr/queries";
import { todayManila, peso } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { PayPanel } from "@/components/hr/pay-panel";
import { PayrollSettingsPanel } from "@/components/hr/settings-panel";

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

  const [report, payList, settings] = await Promise.all([
    payrollReport(from, to),
    canWrite ? staffPayList() : Promise.resolve([]),
    getPayrollSettings(),
  ]);

  const inputCls =
    "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <PageHeader
        backHref="/dashboard" title="HR / Payroll" subtitle={`DTR & payroll (PH daily-rate) · ${from} to ${to}`} />
        <PrintButton label="Print payroll" />
      </div>

      <div className="mb-4 hidden border-b border-stone-300 pb-3 print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Payroll Summary — {from} to {to}</p>
      </div>

      <form method="get" className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">From</label>
          <input type="date" name="from" defaultValue={from} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">To</label>
          <input type="date" name="to" defaultValue={to} className={inputCls} />
        </div>
        <button type="submit" className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900">
          Apply
        </button>
        <a href={`/api/export/hr-payroll?from=${from}&to=${to}`} className="ml-auto rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
          ⬇ Export to Sheets
        </a>
        <Link href={`/hr/performance?from=${from}&to=${to}`} className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
          📊 Staff Performance
        </Link>
      </form>

      {canWrite && (
        <div className="mb-6">
          <PayrollSettingsPanel settings={settings} />
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Payroll summary</h2>
      <div className="mb-6 table-wrap">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-3">Staff</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Daily</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Days</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">½</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Late (m)</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">UT (m)</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">OT (h)</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Night (h)</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Basic</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">OT pay</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Night</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Deduct</th>
              <th className="px-3 py-3 whitespace-nowrap text-right">Net pay</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-stone-500">No completed time records in this range.</td>
              </tr>
            )}
            {report.rows.map((r) => (
              <tr key={r.userId} className="border-b border-stone-100 align-top last:border-0">
                <td className="px-3 py-2.5 min-w-[9rem]">
                  <Link href={`/hr/${r.userId}?from=${from}&to=${to}`} className="font-medium text-amber-700 hover:underline">
                    {r.label}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.dailyRate ? peso(r.dailyRate) : <span className="text-amber-600">set</span>}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.daysPresent}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.halfDays || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.lateMinutes || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.undertimeMinutes || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.otHours || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.nightHours || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{peso(r.basicPay)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.otPay ? peso(r.otPay) : "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">{r.nightPay ? peso(r.nightPay) : "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums text-red-700">{r.deductions ? `(${peso(r.deductions)})` : "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold tabular-nums">{peso(r.netPay)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-semibold">
              <td className="px-3 py-3" colSpan={8}>Total</td>
              <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">{peso(report.basicTotal)}</td>
              <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">{peso(report.otTotal)}</td>
              <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">{peso(report.nightTotal)}</td>
              <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-red-700">{report.deductionTotal ? `(${peso(report.deductionTotal)})` : "—"}</td>
              <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">{peso(report.netTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mb-6 text-xs text-stone-400">
        Hourly = daily ÷ {settings.standard_hours}. OT = hourly × {settings.ot_multiplier}. Night diff = {Math.round(settings.night_diff_rate * 100)}% ({settings.night_start.slice(0, 5)}–{settings.night_end.slice(0, 5)}). Undertime is not offset by OT (Art. 88). Click a name for the daily DTR.
      </p>

      {canWrite && (
        <>
          <h2 className="no-print mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Daily rates</h2>
          <PayPanel rows={payList} />
          <p className="no-print mt-2 text-xs text-stone-400">Confirm final payroll figures with accounting.</p>
        </>
      )}
    </>
  );
}
