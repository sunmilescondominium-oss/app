import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { staffPerformance } from "@/lib/hr/performance";
import { todayManila } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Staff Performance" };

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

const inputCls = "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export default async function StaffPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule("hr");
  const sp = await searchParams;
  const from = (typeof sp.from === "string" && sp.from) || monthStart();
  const to = (typeof sp.to === "string" && sp.to) || todayManila();

  const rows = await staffPerformance(from, to);

  return (
    <>
      <Breadcrumb items={[{ label: "HR / Payroll", href: `/hr?from=${from}&to=${to}` }, { label: "Performance" }]} />
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <PageHeader title="Staff Performance" subtitle={`Attendance + activity per staff · ${from} to ${to}`} />
        <PrintButton label="Print report" />
      </div>

      <div className="mb-4 hidden border-b border-stone-300 pb-3 print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Staff Performance — {from} to {to}</p>
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
        <button type="submit" className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900">Apply</button>
        <a href={`/api/export/staff-performance?from=${from}&to=${to}`} className="ml-auto rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
          ⬇ Export to Sheets
        </a>
      </form>

      <div className="table-wrap">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Role(s)</th>
              <th className="px-4 py-3 text-right">Days worked</th>
              <th className="px-4 py-3 text-right">Half days</th>
              <th className="px-4 py-3 text-right">Late days</th>
              <th className="px-4 py-3 text-right">OT (h)</th>
              <th className="px-4 py-3 text-right">Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">No staff activity in this range.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">
                  <Link href={`/hr/${r.userId}?from=${from}&to=${to}`} className="font-medium text-amber-700 hover:underline">{r.label}</Link>
                </td>
                <td className="px-4 py-2.5 text-xs text-stone-500">{r.roles.length ? r.roles.join(", ") : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{r.daysPresent}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.halfDays || "—"}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${r.lateDays > 0 ? "text-amber-700" : ""}`}>{r.lateDays || "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.otHours || "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-indigo-700">{r.activity || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-stone-400">
        <strong>Days worked / late / OT</strong> come from clock records (also the DTR). <strong>Activity</strong> counts logged actions
        (tasks, dispensing, payments, updates) attributed to the staff in the audit trail. Click a name for the daily DTR + activity breakdown.
      </p>
    </>
  );
}
