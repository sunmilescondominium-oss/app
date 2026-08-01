import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listTransmittals } from "@/lib/collections/queries";
import { peso, todayManila } from "@/lib/collections/summary";
import { PageHeader, Badge } from "@/components/ui";
import { BuildTransmittalForm } from "@/components/transmittals/build-form";

export const metadata = { title: "Transmittals" };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
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
    ["hotel_rental_monitoring", "accounting"].includes(r),
  );
  const transmittals = await listTransmittals();

  return (
    <>
      <PageHeader
        title="Transmittals"
        subtitle="Cash transmittal & bank deposit — printable for physical signatures"
        badge={<Badge tone="green">Live</Badge>}
      />

      {canBuild && <BuildTransmittalForm defaultDate={todayManila()} />}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Counted by</th>
              <th className="px-4 py-3">Deposit slip</th>
              <th className="px-4 py-3">Printed</th>
            </tr>
          </thead>
          <tbody>
            {transmittals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No transmittals yet.
                </td>
              </tr>
            )}
            {transmittals.map((t) => {
              const s = STATUS[t.status] ?? { label: t.status, cls: "bg-slate-100 text-slate-600" };
              return (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
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
                  <td className="px-4 py-3 text-slate-500">
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
