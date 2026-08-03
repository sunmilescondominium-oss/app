import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { rentalUnitDetail, duesForUnit, metersForUnit } from "@/lib/rentals/queries";
import { peso } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";
import { StartLeaseForm, LeaseActions, MeterForm, DueForm, MarkPaid } from "@/components/rentals/rental-forms";

export const metadata = { title: "Unit" };

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function RentalUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  await requireModule("rentals");
  const { unitId } = await params;
  const [unit, dues, meters] = await Promise.all([rentalUnitDetail(unitId), duesForUnit(unitId), metersForUnit(unitId)]);
  if (!unit) notFound();

  const one = [{ id: unit.unitId, label: unit.unitNumber, businessLine: unit.businessLine }];

  return (
    <>
      <div className="mb-4">
        <Link href="/rentals" className="text-xs text-amber-700 hover:underline">← Back to Rentals &amp; Airbnb</Link>
        <PageHeader title={`Unit ${unit.unitNumber}`} subtitle={`${unit.propertyName} · ${unit.businessLine}`} />
      </div>

      {/* Occupancy */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        {unit.lease ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-800">{unit.lease.tenantLabel}</p>
              <p className="text-sm text-slate-500">{unit.lease.contact ?? "no contact"}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <div><span className="text-slate-400">Rent</span><br />{peso(unit.lease.rentAmount)}/{unit.lease.billingCycle === "nightly" ? "night" : "mo"}</div>
                <div><span className="text-slate-400">Start</span><br />{unit.lease.startDate}</div>
                <div><span className="text-slate-400">Checkout / end</span><br />{fmt(unit.lease.endAt)}</div>
                <div><span className="text-slate-400">Deposit</span><br />{peso(unit.lease.deposit)}</div>
              </div>
              {unit.lease.notes && <p className="mt-2 text-xs text-slate-400">{unit.lease.notes}</p>}
            </div>
            <LeaseActions leaseId={unit.lease.id} canExtend={unit.businessLine === "airbnb"} />
          </div>
        ) : unit.needsHousekeeping ? (
          <p className="text-sm text-amber-700">🧹 For Housekeeping — not available until cleaning is marked ready.</p>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium text-emerald-700">Vacant — start a lease / booking</p>
            <StartLeaseForm units={one} />
          </div>
        )}
      </div>

      {/* Dues */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Dues</h2>
      <div className="mb-2"><DueForm units={one} /></div>
      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">·</th>
            </tr>
          </thead>
          <tbody>
            {dues.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No dues.</td></tr>}
            {dues.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 capitalize">{d.category.replace("_", " ")}</td>
                <td className={`px-4 py-2.5 ${d.status === "unpaid" && d.overdue ? "text-rose-700" : d.status === "unpaid" && d.dueSoon ? "text-amber-700" : "text-slate-600"}`}>{d.dueDate}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(d.amount)}</td>
                <td className="px-4 py-2.5 capitalize">{d.status}{d.paidOn ? <span className="text-xs text-slate-400"> · {d.paidOn}</span> : null}</td>
                <td className="px-4 py-2.5 text-right">{d.status === "unpaid" && <MarkPaid id={d.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Meter readings */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Meter readings</h2>
      <div className="mb-2"><MeterForm units={one} /></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Utility</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Reading</th>
              <th className="px-4 py-3 text-right">Consumption</th>
            </tr>
          </thead>
          <tbody>
            {meters.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No readings.</td></tr>}
            {meters.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 capitalize">{m.utility}</td>
                <td className="px-4 py-2.5">{m.readOn}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{m.reading}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{m.consumption != null ? m.consumption : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
