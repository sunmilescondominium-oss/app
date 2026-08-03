import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { getTransmittal } from "@/lib/collections/queries";
import { summarizeCollections, peso } from "@/lib/collections/summary";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { TransmittalActions } from "@/components/transmittals/transmittal-actions";

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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-lg font-bold text-slate-900">{APP_BRAND_SHORT}</p>
            <p className="text-sm text-slate-500">Cash Transmittal</p>
          </div>
          <div className="text-right text-sm text-slate-700">
            <p>
              Date: <strong>{t.transmittal_date}</strong>
            </p>
            <p className="text-slate-500">Ref: {t.id.slice(0, 8).toUpperCase()}</p>
            <p>Status: {STATUS_LABEL[t.status] ?? t.status}</p>
          </div>
        </div>

        <table className="mt-5 w-full text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 text-left">Category</th>
              <th className="py-2 text-right">Entries</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((r) => (
              <tr key={r.category} className="border-b border-slate-100">
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

        {t.counted_cash != null && (
          <p className="mt-3 text-sm text-slate-700">
            Cash counted (bills &amp; coins): <strong className="tabular-nums">{peso(Number(t.counted_cash))}</strong>
            {Number(t.counted_cash) !== Number(t.total_amount) && (
              <span className="ml-2 text-amber-700">
                (variance vs total: {peso(Number(t.counted_cash) - Number(t.total_amount))} — total includes online payments)
              </span>
            )}
          </p>
        )}

        <p className="mt-4 text-sm text-slate-700">
          Bank deposit slip ref:{" "}
          <strong>{t.deposit_slip_ref ?? "________________"}</strong>
        </p>

        {/* Role-based signature lines (never person names) */}
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {signatures.map((s) => (
            <div key={s.title}>
              <div className="h-10 border-b border-slate-400" />
              <p className="mt-1 text-xs font-semibold text-slate-700">{s.title}</p>
              <p className="text-xs text-slate-500">Role: {roleLabel(s.role)}</p>
              <p className="mt-1 text-[10px] text-slate-400">
                Signature over printed name / date
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[10px] text-slate-400">{APP_BRAND}</p>
        {t.printed_at && (
          <p className="text-[10px] text-slate-400">
            Printed {new Date(t.printed_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="no-print mt-4">
        <TransmittalActions
          id={t.id}
          status={t.status}
          canWrite={canWrite}
          canReconcile={canReconcile}
        />
      </div>
    </>
  );
}
