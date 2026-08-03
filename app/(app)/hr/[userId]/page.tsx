import { requireModule } from "@/lib/auth/dal";
import { dtrDetail } from "@/lib/hr/queries";
import { staffActivityBreakdown } from "@/lib/hr/performance";
import { todayManila, peso } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "DTR detail" };

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function t(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

const STATUS: Record<string, string> = {
  present: "text-emerald-700",
  half_day: "text-amber-700",
  absent: "text-red-700",
  open: "text-stone-400",
};

export default async function DtrDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule("hr");
  const { userId } = await params;
  const sp = await searchParams;
  const from = (typeof sp.from === "string" && sp.from) || monthStart();
  const to = (typeof sp.to === "string" && sp.to) || todayManila();

  const [{ label, dailyRate, days }, activity] = await Promise.all([
    dtrDetail(userId, from, to),
    staffActivityBreakdown(userId, from, to),
  ]);

  const totals = days.reduce(
    (a, d) => ({
      basic: a.basic + d.basicPay,
      ot: a.ot + d.otPay,
      night: a.night + d.nightPay,
      deduct: a.deduct + d.lateDeduction + d.undertimeDeduction,
      net: a.net + d.netPay,
    }),
    { basic: 0, ot: 0, night: 0, deduct: 0, net: 0 },
  );
  const r2 = (n: number) => Math.round(n * 100) / 100;

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <div>
          <Breadcrumb items={[{ label: "HR / Payroll", href: `/hr?from=${from}&to=${to}` }, { label: "DTR" }]} />
          <PageHeader title={`DTR — ${label}`} subtitle={`${peso(dailyRate)}/day · ${from} to ${to}`} />
        </div>
        <PrintButton label="Print DTR" />
      </div>

      <div className="mb-4 hidden border-b border-stone-300 pb-3 print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Daily Time Record — {label} · {peso(dailyRate)}/day · {from} to {to}</p>
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">In</th>
              <th className="px-3 py-3">Out</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Late (m)</th>
              <th className="px-3 py-3 text-right">UT (m)</th>
              <th className="px-3 py-3 text-right">Reg (h)</th>
              <th className="px-3 py-3 text-right">OT (h)</th>
              <th className="px-3 py-3 text-right">Night (h)</th>
              <th className="px-3 py-3 text-right">Basic</th>
              <th className="px-3 py-3 text-right">OT</th>
              <th className="px-3 py-3 text-right">Night</th>
              <th className="px-3 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-stone-500">No records in this range.</td>
              </tr>
            )}
            {days.map((d, i) => (
              <tr key={`${d.date}-${i}`} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2.5">{d.date}</td>
                <td className="px-3 py-2.5">{t(d.timeIn)}</td>
                <td className="px-3 py-2.5">{d.timeOut ? t(d.timeOut) : <span className="text-emerald-600">open</span>}</td>
                <td className={`px-3 py-2.5 capitalize ${STATUS[d.status]}`}>{d.status.replace("_", " ")}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{d.lateMinutes || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{d.undertimeMinutes || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{d.regularHours || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{d.otHours || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{d.nightHours || "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{peso(d.basicPay)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{d.otPay ? peso(d.otPay) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{d.nightPay ? peso(d.nightPay) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{peso(d.netPay)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-semibold">
              <td className="px-3 py-3" colSpan={9}>Total</td>
              <td className="px-3 py-3 text-right tabular-nums">{peso(r2(totals.basic))}</td>
              <td className="px-3 py-3 text-right tabular-nums">{peso(r2(totals.ot))}</td>
              <td className="px-3 py-3 text-right tabular-nums">{peso(r2(totals.night))}</td>
              <td className="px-3 py-3 text-right tabular-nums">{peso(r2(totals.net))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {totals.deduct > 0 && (
        <p className="mt-2 text-xs text-stone-500">Total late/undertime deductions already reflected in Basic: {peso(r2(totals.deduct))}.</p>
      )}

      <h2 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Activity in this period</h2>
      {activity.length === 0 ? (
        <p className="text-sm text-stone-500">No logged activity in this range.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {activity.map((a) => (
            <span key={a.entity} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm">
              <span className="capitalize text-stone-600">{a.entity.replace(/_/g, " ")}</span>
              <span className="font-semibold tabular-nums text-indigo-700">{a.count}</span>
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-stone-400">Counts of actions this staff logged (created/updated records) in the period, from the audit trail.</p>
    </>
  );
}
