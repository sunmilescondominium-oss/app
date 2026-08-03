import { requireModule } from "@/lib/auth/dal";
import { occupancyBoard, listDues, listMeterReadings, rentalUnitOptions, reminders } from "@/lib/rentals/queries";
import { peso } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";
import { StartLeaseForm, LeaseActions, MeterForm, DueForm, MarkPaid } from "@/components/rentals/rental-forms";

export const metadata = { title: "Rentals & Airbnb" };

function fmtCheckout(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 0) return `overdue ${Math.abs(mins)}m`;
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export default async function RentalsPage() {
  await requireModule("rentals");
  const [board, dues, meters, units] = await Promise.all([
    occupancyBoard(),
    listDues(),
    listMeterReadings(),
    rentalUnitOptions(),
  ]);
  const rem = await reminders(board);
  const vacant = units.filter((u) => !board.find((b) => b.unitId === u.id && b.lease));

  return (
    <>
      <PageHeader title="Rentals & Airbnb" subtitle="Occupancy, dues, and meter readings." />

      {/* Reminders (staff) */}
      {rem.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Reminders</p>
          <div className="flex flex-wrap gap-2">
            {rem.map((r, i) => (
              <span key={i} className={`rounded-full px-3 py-1 text-xs font-medium ${r.tone === "red" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                {r.kind === "checkout" ? "🕒" : "₱"} {r.label} — {r.detail}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-amber-700/80">TODO: SMS / email reminders to tenants &amp; guests will be enabled next.</p>
        </div>
      )}

      {/* Occupancy */}
      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Occupancy</h2>
      <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3">Tenant / guest</th>
              <th className="px-4 py-3">Checkout</th>
              <th className="px-4 py-3">Next due</th>
              <th className="px-4 py-3 text-right">·</th>
            </tr>
          </thead>
          <tbody>
            {board.map((b) => (
              <tr key={b.unitId} className={`border-b border-slate-100 last:border-0 ${b.checkoutSoon ? "bg-amber-50/60" : ""}`}>
                <td className="px-4 py-2.5 font-medium text-slate-800">{b.unitNumber}<span className="ml-1 text-xs text-slate-400">{b.propertyName}</span></td>
                <td className="px-4 py-2.5 capitalize">{b.businessLine}</td>
                <td className="px-4 py-2.5">
                  {b.lease ? <span>{b.lease.tenantLabel}{b.lease.contact ? <span className="text-xs text-slate-400"> · {b.lease.contact}</span> : null}</span> : <span className="text-emerald-600">Vacant</span>}
                </td>
                <td className="px-4 py-2.5">
                  {b.businessLine === "airbnb" && b.lease?.endAt ? (
                    <span className={b.checkoutSoon ? "font-medium text-amber-700" : "text-slate-600"}>{fmtCheckout(b.checkoutInMins)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {b.nextDue ? (
                    <span className={b.nextDue.overdue ? "text-rose-700" : b.nextDue.dueSoon ? "text-amber-700" : "text-slate-600"}>
                      {peso(b.nextDue.amount)} · {b.nextDue.dueDate}
                    </span>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right">{b.lease && <LeaseActions leaseId={b.lease.id} canExtend={b.businessLine === "airbnb"} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-6"><StartLeaseForm units={vacant} /></div>

      {/* Dues */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Dues</h2>
      <div className="mb-2"><DueForm units={units} /></div>
      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">·</th>
            </tr>
          </thead>
          <tbody>
            {dues.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No dues recorded.</td></tr>}
            {dues.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">{d.unitNumber}</td>
                <td className="px-4 py-2.5 capitalize">{d.category.replace("_", " ")}</td>
                <td className={`px-4 py-2.5 ${d.status === "unpaid" && d.overdue ? "text-rose-700" : d.status === "unpaid" && d.dueSoon ? "text-amber-700" : "text-slate-600"}`}>{d.dueDate}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(d.amount)}</td>
                <td className="px-4 py-2.5 capitalize">{d.status}</td>
                <td className="px-4 py-2.5 text-right">{d.status === "unpaid" && <MarkPaid id={d.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Meter readings */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Meter readings</h2>
      <div className="mb-2"><MeterForm units={units} /></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Utility</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Reading</th>
              <th className="px-4 py-3 text-right">Consumption</th>
            </tr>
          </thead>
          <tbody>
            {meters.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No readings yet.</td></tr>}
            {meters.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">{m.unitNumber}</td>
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
