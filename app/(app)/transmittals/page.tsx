import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listTransmittals, getReceiptSeries } from "@/lib/collections/queries";
import { peso, todayManila } from "@/lib/collections/summary";
import { PageHeader, Badge } from "@/components/ui";
import { BuildTransmittalForm } from "@/components/transmittals/build-form";
import { ReceiptSeriesPanel } from "@/components/transmittals/receipt-series";

export const metadata = { title: "Transmittals" };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-stone-100 text-stone-600" },
  submitted: { label: "Submitted", cls: "bg-amber-100 text-amber-800" },
  deposited: { label: "Deposited", cls: "bg-blue-100 text-blue-800" },
  reconciled: { label: "Reconciled", cls: "bg-emerald-100 text-emerald-800" },
};

function roleLabel(rk: string | null): string {
  if (!rk) return "—";
  return rk.charAt(0).toUpperCase() + rk.slice(1).replace(/_/g, " ");
}

export default async function TransmittalsPage() {
  const user = await requireModule("transmittals");
  const canBuild = user.roleKeys.some((r) =>
    ["hotel_rental_monitoring", "accounting", "hotel_cashier"].includes(r),
  );
  const canSeries = user.roleKeys.some((r) => ["admin", "hotel_rental_monitoring"].includes(r));
  const [transmittals, series] = await Promise.all([listTransmittals(), canSeries ? getReceiptSeries() : Promise.resolve([])]);

  // Daily reconciliation tally (accounting) — collected vs deposited per day.
  const byDate = new Map<string, { collected: number; deposited: number; reconciled: number; passbook: number; count: number }>();
  for (const t of transmittals) {
    const d = byDate.get(t.transmittal_date) ?? { collected: 0, deposited: 0, reconciled: 0, passbook: 0, count: 0 };
    d.collected += Number(t.total_amount);
    d.deposited += Number(t.deposited_amount ?? 0);
    if (t.status === "reconciled") d.reconciled += 1;
    if (t.passbook_returned_on) d.passbook += 1;
    d.count += 1;
    byDate.set(t.transmittal_date, d);
  }
  const tally = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Transmittals"
        subtitle="Cash transmittal & bank deposit — printable for physical signatures"
        badge={<Badge tone="green">Live</Badge>}
      />

      {canBuild && <BuildTransmittalForm defaultDate={todayManila()} />}
      {canSeries && series.length > 0 && <ReceiptSeriesPanel series={series} />}

      {/* Daily reconciliation tally — accounting, before the final owner report */}
      <h2 className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Daily reconciliation</h2>
      <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Transmittals</th>
              <th className="px-4 py-3 text-right">Collected</th>
              <th className="px-4 py-3 text-right">Deposited</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3 text-right">Reconciled</th>
              <th className="px-4 py-3 text-right">Passbook</th>
            </tr>
          </thead>
          <tbody>
            {tally.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-500">No data.</td></tr>}
            {tally.map(([date, d]) => {
              const variance = Math.round((d.deposited - d.collected) * 100) / 100;
              return (
                <tr key={date} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{date}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{peso(d.collected)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.deposited ? peso(d.deposited) : "—"}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${d.deposited && variance ? "text-amber-700" : "text-stone-400"}`}>{d.deposited ? peso(variance) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.reconciled}/{d.count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.passbook}/{d.count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mb-4 text-xs text-stone-400">Accounting tallies collected vs deposited and passbook returns here before the final report to the owner.</p>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">All transmittals</h2>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Counted by</th>
              <th className="px-4 py-3">Deposit slip</th>
              <th className="px-4 py-3">Passbook</th>
              <th className="px-4 py-3">Printed</th>
            </tr>
          </thead>
          <tbody>
            {transmittals.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-stone-500">
                  No transmittals yet.
                </td>
              </tr>
            )}
            {transmittals.map((t) => {
              const s = STATUS[t.status] ?? { label: t.status, cls: "bg-stone-100 text-stone-600" };
              return (
                <tr key={t.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/transmittals/${t.id}`} className="font-medium text-amber-700 hover:underline">
                      {t.transmittal_date}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{peso(t.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">{roleLabel(t.counted_by_role)}</td>
                  <td className="px-4 py-3">{t.deposit_slip_ref ?? "—"}</td>
                  <td className="px-4 py-3 text-stone-500">{t.passbook_returned_on ? `✓ ${t.passbook_returned_on}` : "—"}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {t.printed_at ? "✓" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
