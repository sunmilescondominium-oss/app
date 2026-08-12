import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { rentalUnitDetail, duesForUnit, metersForUnit, leaseDocuments } from "@/lib/rentals/queries";
import { peso } from "@/lib/collections/summary";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { canWriteModule, canReadModule } from "@/lib/rbac/modules";
import { StartLeaseForm, LeaseActions, MeterForm, DueForm, MarkPaid, UtilityAccountForm } from "@/components/rentals/rental-forms";
import { RenterDetails, LeaseDocsChecklist } from "@/components/rentals/renter-details";
import { listDocPhotos } from "@/lib/docs/photos";
import { PhotoDocPanel } from "@/components/capture/photo-doc-panel";

export const metadata = { title: "Unit" };

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function RentalUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const user = await requireModule("rentals");
  const canWrite = canWriteModule(user.roleKeys, "rentals");
  const { unitId } = await params;
  const [unit, dues, meters] = await Promise.all([rentalUnitDetail(unitId), duesForUnit(unitId), metersForUnit(unitId)]);
  if (!unit) notFound();
  const docs = unit.lease ? await leaseDocuments(unit.lease.id) : [];
  const conditionPhotos = unit.lease ? await listDocPhotos("lease", unit.lease.id) : [];

  const one = [{ id: unit.unitId, label: unit.unitNumber, businessLine: unit.businessLine }];

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Breadcrumb items={[{ label: "Rentals & Airbnb", href: "/rentals" }, { label: `Unit ${unit.unitNumber}` }]} />
          <PageHeader title={`Unit ${unit.unitNumber}`} subtitle={`${unit.propertyName} · ${unit.businessLine}`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/rentals/${unitId}/letter`} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100">
            ✉ Reminder letter
          </Link>
          <Link href={`/rentals/${unitId}/bill`} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Monthly bill →
          </Link>
        </div>
      </div>

      {/* Occupancy */}
      <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
        {unit.lease ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-stone-800">{unit.lease.tenantLabel}</p>
              <p className="text-sm text-stone-500">{unit.lease.contact ?? "no contact"}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <div><span className="text-stone-400">Rent</span><br />{peso(unit.lease.rentAmount)}/{unit.lease.billingCycle === "nightly" ? "night" : "mo"}</div>
                <div><span className="text-stone-400">Start</span><br />{unit.lease.startDate}</div>
                <div><span className="text-stone-400">Checkout / end</span><br />{fmt(unit.lease.endAt)}</div>
                <div><span className="text-stone-400">Deposit</span><br />{peso(unit.lease.deposit)}</div>
              </div>
              {unit.lease.notes && <p className="mt-2 text-xs text-stone-400">{unit.lease.notes}</p>}
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

      {/* Airbnb guest requests + booking QR */}
      {unit.businessLine === "airbnb" && unit.lease && (unit.lease.checkoutRequested || unit.lease.extensionRequested) && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {unit.lease.checkoutRequested && <p>🔔 <strong>Guest requested check-out</strong> — settle extra charges, check the unit, and turn over to housekeeping.</p>}
          {unit.lease.extensionRequested && <p>⏱️ <strong>Guest requested to extend:</strong> “{unit.lease.extensionRequested}” — confirm the new checkout &amp; rate.</p>}
        </div>
      )}
      {unit.businessLine === "airbnb" && unit.lease?.portalToken && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/airbnb/${unit.lease.portalToken}/qr`} alt="Booking QR" className="h-24 w-24" />
          <div className="text-sm">
            <p className="font-medium text-stone-800">Guest booking QR</p>
            <p className="text-stone-500">Guest scans this to see their bill + timer, request an extension, or check out.</p>
            <a href={`/airbnb/${unit.lease.portalToken}`} target="_blank" rel="noreferrer" className="text-xs text-amber-700 hover:underline">open guest view ↗</a>
          </div>
        </div>
      )}

      {/* Renter details + document checklist */}
      {unit.lease && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <RenterDetails lease={unit.lease} />
          <LeaseDocsChecklist leaseId={unit.lease.id} docs={docs} />
        </div>
      )}

      {unit.lease && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <PhotoDocPanel entity="lease" entityId={unit.lease.id} kind="move_in" title="Move-in condition" label={`Move-in · Unit ${unit.unitNumber}`} canWrite={canWrite} canView={canReadModule(user.roleKeys, "media")} photos={conditionPhotos} />
          <PhotoDocPanel entity="lease" entityId={unit.lease.id} kind="move_out" title="Move-out condition" label={`Move-out · Unit ${unit.unitNumber}`} canWrite={canWrite} canView={canReadModule(user.roleKeys, "media")} photos={conditionPhotos} />
        </div>
      )}

      {/* Dues */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Dues</h2>
      <div className="mb-2"><DueForm units={one} /></div>
      <div className="mb-6 table-wrap">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">·</th>
            </tr>
          </thead>
          <tbody>
            {dues.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">No dues.</td></tr>}
            {dues.map((d) => (
              <tr key={d.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5 capitalize">{d.category.replace("_", " ")}</td>
                <td className={`px-4 py-2.5 ${d.status === "unpaid" && d.overdue ? "text-rose-700" : d.status === "unpaid" && d.dueSoon ? "text-amber-700" : "text-stone-600"}`}>{d.dueDate}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(d.amount)}</td>
                <td className="px-4 py-2.5 capitalize">{d.status}{d.paidOn ? <span className="text-xs text-stone-400"> · {d.paidOn}</span> : null}</td>
                <td className="px-4 py-2.5 text-right">{d.status === "unpaid" && <MarkPaid id={d.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Meter readings */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Meter readings</h2>
        <div className="flex items-center gap-4 text-xs text-stone-500">
          {unit.meralcoCan && <span>⚡ CAN: <span className="font-mono text-stone-700">{unit.meralcoCan}</span></span>}
          {unit.waterAccountNo && <span>💧 Water: <span className="font-mono text-stone-700">{unit.waterAccountNo}</span></span>}
          <UtilityAccountForm unitId={unit.unitId} meralcoCan={unit.meralcoCan} waterAccountNo={unit.waterAccountNo} />
        </div>
      </div>
      <div className="mb-2"><MeterForm units={one} /></div>
      <div className="table-wrap">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Utility</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Reading</th>
              <th className="px-4 py-3 text-right">Consumption</th>
              <th className="px-4 py-3 text-right">Bill ₱</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">OR / Ref</th>
              <th className="px-4 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {meters.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-stone-500">No readings.</td></tr>}
            {meters.map((m) => (
              <tr key={m.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5 capitalize">{m.utility}</td>
                <td className="px-4 py-2.5">{m.readOn}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{m.reading}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{m.consumption != null ? m.consumption : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{m.billAmount != null ? `₱${m.billAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}</td>
                <td className="px-4 py-2.5">{m.billingPeriod ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{m.orNumber ?? "—"}</td>
                <td className={`px-4 py-2.5 ${m.dueDate ? "text-rose-700" : "text-stone-400"}`}>{m.dueDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
