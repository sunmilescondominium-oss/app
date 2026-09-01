import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listTransmittals, getReceiptSeries, listDeletedTransmittals, listPendingCheckCollections } from "@/lib/collections/queries";
import { listAccountOptions } from "@/lib/banking/queries";
import { peso, todayManila } from "@/lib/collections/summary";
import { PageHeader, Badge } from "@/components/ui";
import { BuildTransmittalForm } from "@/components/transmittals/build-form";
import { ReceiptSeriesPanel } from "@/components/transmittals/receipt-series";
import { HelpPanel } from "@/components/guide/help";
import { DeletedTransmittalsPanel } from "@/components/collections/deleted-records-panel";
import { restoreTransmittal, purgeTransmittal } from "@/app/(app)/collections/actions";

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
  const canRestore = user.allRoleKeys.some((r) =>
    ["admin", "managing_officer", "consultant", "accounting"].includes(r),
  );
  const isConsultant = user.allRoleKeys.includes("consultant");

  const canSeeChecks = user.allRoleKeys.some((r) =>
    ["accounting", "managing_officer", "consultant", "hotel_rental_monitoring"].includes(r),
  );

  const [transmittals, series, bankAccounts, deletedTransmittals, pendingChecks] = await Promise.all([
    listTransmittals(),
    canSeries ? getReceiptSeries() : Promise.resolve([]),
    canBuild ? listAccountOptions() : Promise.resolve([]),
    canRestore ? listDeletedTransmittals() : Promise.resolve([]),
    canSeeChecks ? listPendingCheckCollections() : Promise.resolve([]),
  ]);

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

      <HelpPanel
        title="How a transmittal moves cash to the bank"
        steps={[
          "Cashier counts the cash and builds a transmittal, then prints it.",
          "Hotel/rental monitoring re-counts, records it, and transmits to the liaison.",
          "Accounting issues the bank passbook.",
          "The liaison counts the cash, prepares the deposit slip, and picks the bank account.",
          "Mark it deposited — the amount is recorded against that bank account automatically.",
          "Open any transmittal to see its chain-of-custody timeline; only the role whose turn it is sees the next step.",
        ]}
      />

      <div className="no-print mb-4">
        <a href="/api/export/transmittals" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
          ⬇ Export to Sheets
        </a>
      </div>

      {/* Checks-in-custody panel — visible to accounting, monitoring, management */}
      {canSeeChecks && pendingChecks.length > 0 && (() => {
        const today = todayManila();
        const ready = pendingChecks.filter((c) => c.check_date && c.check_date <= today);
        const postdated = pendingChecks.filter((c) => !c.check_date || c.check_date > today);
        const readyTotal = ready.reduce((s, c) => s + c.amount, 0);
        const postdatedTotal = postdated.reduce((s, c) => s + c.amount, 0);
        return (
          <div className="no-print mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-amber-900">Checks in custody — not yet transmitted</p>
                <p className="text-xs text-amber-700">
                  These physical checks are held by hotel/rental monitoring pending transmittal to the bank.
                </p>
              </div>
              <div className="flex gap-4 text-xs">
                {ready.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                    {ready.length} ready — {peso(readyTotal)}
                  </span>
                )}
                {postdated.length > 0 && (
                  <span className="rounded-full bg-amber-200 px-2.5 py-1 font-semibold text-amber-900">
                    {postdated.length} post-dated — {peso(postdatedTotal)}
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-amber-200 text-xs uppercase tracking-wide text-amber-700">
                  <tr>
                    <th className="py-2 pr-4">OR #</th>
                    <th className="py-2 pr-4">Check #</th>
                    <th className="py-2 pr-4">Bank</th>
                    <th className="py-2 pr-4">Collected</th>
                    <th className="py-2 pr-4">Check date</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingChecks.map((c) => {
                    const isReady = c.check_date && c.check_date <= today;
                    const isPostdated = c.check_date && c.check_date > today;
                    return (
                      <tr key={c.id} className="border-b border-amber-100 last:border-0">
                        <td className="py-2 pr-4 tabular-nums">{c.or_number ?? "—"}</td>
                        <td className="py-2 pr-4 tabular-nums">{c.check_number ?? "—"}</td>
                        <td className="py-2 pr-4">{c.check_bank ?? "—"}</td>
                        <td className="py-2 pr-4">{c.collected_on}</td>
                        <td className="py-2 pr-4">
                          <span className="flex items-center gap-1.5">
                            {c.check_date ?? "—"}
                            {isReady && (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Ready</span>
                            )}
                            {isPostdated && (
                              <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Post-dated</span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 pr-4 capitalize">
                          {c.business_line.replace(/_/g, " ")}
                          {c.unit_number ? <span className="ml-1 text-stone-500">· {c.unit_number}</span> : null}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium">{peso(c.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-amber-900">
                    <td colSpan={6} className="pt-2.5">Total in custody</td>
                    <td className="pt-2.5 text-right tabular-nums">{peso(pendingChecks.reduce((s, c) => s + c.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {ready.length > 0 && (
              <p className="mt-2 text-xs text-emerald-800">
                ⚠ {ready.length} check{ready.length > 1 ? "s are" : " is"} due for deposit today or earlier. Bundle them into a transmittal now.
              </p>
            )}
          </div>
        );
      })()}

      {canBuild && <BuildTransmittalForm defaultDate={todayManila()} bankAccounts={bankAccounts} />}
      {canSeries && series.length > 0 && <ReceiptSeriesPanel series={series} />}

      {/* Daily reconciliation tally — accounting, before the final owner report */}
      <h2 className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Daily reconciliation</h2>
      <div className="mb-6 table-wrap">
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
      <div className="table-wrap">
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

      {canRestore && deletedTransmittals.length > 0 && (
        <DeletedTransmittalsPanel
          items={deletedTransmittals}
          canRestore={canRestore}
          canPurge={isConsultant}
          onRestore={restoreTransmittal}
          onPurge={purgeTransmittal}
        />
      )}
    </>
  );
}
