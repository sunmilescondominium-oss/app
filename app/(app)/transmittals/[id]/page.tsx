import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { getTransmittal, listCustody } from "@/lib/collections/queries";
import { summarizeCollections, peso } from "@/lib/collections/summary";
import { canActOnStage, nextStage, type CustodyStage } from "@/lib/collections/custody";
import { listAccountOptions } from "@/lib/banking/queries";
import { APP_BRAND, APP_BRAND_SHORT, PHP_DENOMINATIONS } from "@/lib/config";
import { TransmittalActions } from "@/components/transmittals/transmittal-actions";
import { CustodyPanel } from "@/components/transmittals/custody-panel";

export const metadata = { title: "Transmittal" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  deposited: "Deposited",
  reconciled: "Reconciled",
};

function roleLabel(rk: string | null): string {
  if (!rk) return "—";
  return rk.charAt(0).toUpperCase() + rk.slice(1).replace(/_/g, " ");
}

export default async function TransmittalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireModule("transmittals");
  const t = await getTransmittal(id);
  if (!t) notFound();

  const summary = summarizeCollections(t.transmittal_date, t.collections);
  const canWrite = canWriteModule(user.roleKeys, "transmittals");

  const currentStage = (t.custody_stage as CustodyStage) ?? "cashier_count";
  const upcoming = nextStage(currentStage);
  const [custodyEvents, bankAccounts] = await Promise.all([
    listCustody(t.id),
    upcoming && (upcoming === "liaison_count" || upcoming === "deposited") ? listAccountOptions() : Promise.resolve([]),
  ]);
  const canActNext = upcoming ? canActOnStage(user.roleKeys, upcoming) : false;
  const canReconcile = user.roleKeys.some((r) =>
    ["accounting", "managing_officer"].includes(r),
  );

  const signatures = [
    { title: "Counted by", role: t.counted_by_role },
    { title: "Bank deposit confirmed by", role: t.confirmed_by_role },
    { title: "Reconciled by", role: t.reconciled_by_role },
  ];

  return (
    <>
      <div className="no-print mb-4">
        <Link href="/transmittals" className="text-sm font-medium text-amber-700 hover:underline">
          ← All transmittals
        </Link>
      </div>

      {/* Printable document */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-stone-200 pb-4">
          <div>
            <p className="text-lg font-bold text-stone-900">{APP_BRAND_SHORT}</p>
            <p className="text-sm text-stone-500">Cash Transmittal</p>
          </div>
          <div className="text-right text-sm text-stone-700">
            <p>
              Date: <strong>{t.transmittal_date}</strong>
            </p>
            <p className="text-stone-500">Ref: {t.id.slice(0, 8).toUpperCase()}</p>
            <p>Status: {STATUS_LABEL[t.status] ?? t.status}</p>
          </div>
        </div>

        <table className="mt-5 w-full text-sm">
          <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-2 text-left">Category</th>
              <th className="py-2 text-right">Entries</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <tr key={r.category} className="border-b border-stone-100">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right tabular-nums">{r.count}</td>
                <td className="py-2 text-right tabular-nums">{peso(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2.5">Grand total</td>
              <td className="py-2.5 text-right tabular-nums">{summary.count}</td>
              <td className="py-2.5 text-right tabular-nums">{peso(t.total_amount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Reconciliation figures */}
        {(() => {
          const compareTo = t.deposited_amount ?? t.counted_cash;
          const variance = compareTo == null ? null : Math.round((Number(compareTo) - Number(t.total_amount)) * 100) / 100;
          return (
            <div className="mt-4 rounded-xl border border-stone-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Reconciliation</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <div><span className="text-stone-400">Collected (reported)</span><br /><span className="font-medium tabular-nums">{peso(t.total_amount)}</span></div>
                <div><span className="text-stone-400">Cash counted</span><br /><span className="tabular-nums">{t.counted_cash != null ? peso(Number(t.counted_cash)) : "—"}</span></div>
                <div><span className="text-stone-400">Deposited</span><br /><span className="tabular-nums">{t.deposited_amount != null ? peso(Number(t.deposited_amount)) : "—"}</span></div>
                <div>
                  <span className="text-stone-400">Variance</span><br />
                  <span className={`tabular-nums ${variance ? "text-amber-700" : "text-emerald-700"}`}>{variance == null ? "—" : peso(variance)}</span>
                </div>
              </div>
              {t.total_amount !== (t.counted_cash ?? t.total_amount) && (
                <p className="mt-1 text-[11px] text-stone-400">Total includes online payments; counted cash is physical bills &amp; coins only.</p>
              )}
            </div>
          );
        })()}

        {/* Denomination breakdown — for the errand carrying the cash */}
        {t.denomination_counts && Object.values(t.denomination_counts).some((n) => Number(n) > 0) && (
          <div className="mt-3 rounded-xl border border-stone-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Cash count (bills &amp; coins)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm sm:grid-cols-3">
              {PHP_DENOMINATIONS.filter((d) => Number(t.denomination_counts![String(d.value)] ?? 0) > 0).map((d) => {
                const qty = Number(t.denomination_counts![String(d.value)]);
                return (
                  <div key={`${d.kind}-${d.value}`} className="flex justify-between tabular-nums">
                    <span className="text-stone-500">{d.value < 1 ? `¢${d.value * 100}` : `₱${d.value}`} × {qty}</span>
                    <span>{peso(d.value * qty)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-4 text-sm text-stone-700">
          Bank deposit slip ref:{" "}
          <strong>{t.deposit_slip_ref ?? "________________"}</strong>
        </p>
        <p className="mt-1 text-sm text-stone-700">
          Passbook:{" "}
          {t.passbook_returned_on ? (
            <strong className="text-emerald-700">returned to accounting {t.passbook_returned_on} ({roleLabel(t.passbook_returned_by_role)})</strong>
          ) : (
            <span className="text-amber-700">pending return to accounting</span>
          )}
        </p>

        {/* Role-based signature lines (never person names) */}
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {signatures.map((s) => (
            <div key={s.title}>
              <div className="h-10 border-b border-stone-400" />
              <p className="mt-1 text-xs font-semibold text-stone-700">{s.title}</p>
              <p className="text-xs text-stone-500">Role: {roleLabel(s.role)}</p>
              <p className="mt-1 text-[10px] text-stone-400">
                Signature over printed name / date
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[10px] text-stone-400">{APP_BRAND}</p>
        {t.printed_at && (
          <p className="text-[10px] text-stone-400">
            Printed {new Date(t.printed_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="no-print mt-4">
        <CustodyPanel
          transmittalId={t.id}
          currentStage={currentStage}
          total={t.total_amount}
          events={custodyEvents}
          canActNext={canActNext}
          bankAccounts={bankAccounts}
        />
      </div>

      <div className="no-print mt-4">
        <TransmittalActions
          id={t.id}
          status={t.status}
          canWrite={canWrite}
          canReconcile={canReconcile}
          passbookReturned={Boolean(t.passbook_returned_on)}
        />
      </div>
    </>
  );
}
