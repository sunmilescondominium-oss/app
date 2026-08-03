import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { condoUnitDetail } from "@/lib/condo/queries";
import { duesForUnit, metersForUnit } from "@/lib/rentals/queries";
import { peso } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";
import { MeterForm, DueForm, MarkPaid } from "@/components/rentals/rental-forms";

export const metadata = { title: "Condo Unit" };

export default async function CondoUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  await requireModule("condo");
  const { unitId } = await params;
  const [unit, dues, meters] = await Promise.all([condoUnitDetail(unitId), duesForUnit(unitId), metersForUnit(unitId)]);
  if (!unit) notFound();
  const one = [{ id: unit.unitId, label: unit.unitNumber, businessLine: "condo_sales" }];

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Link href="/condo" className="text-xs text-amber-700 hover:underline">← Back to Condo Dues</Link>
          <PageHeader title={`Unit ${unit.unitNumber}`} subtitle={`${unit.propertyName} · ${unit.areaSqm} sqm × ₱${unit.effectiveRate}/sqm`} />
        </div>
        <Link href={`/condo/${unitId}/bill`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Statement →</Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Monthly association dues</p><p className="mt-1 text-lg font-semibold tabular-nums">{peso(unit.monthlyDues)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Unpaid total</p><p className="mt-1 text-lg font-semibold tabular-nums text-rose-700">{peso(unit.unpaidTotal)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Area</p><p className="mt-1 text-lg font-semibold tabular-nums">{unit.areaSqm} sqm</p></div>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Dues & utilities</h2>
      <div className="mb-2"><DueForm units={one} /></div>
      <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Due</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">·</th></tr>
          </thead>
          <tbody>
            {dues.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No dues.</td></tr>}
            {dues.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 capitalize">{d.category.replace("_", " ")}{d.remarks ? <span className="block text-[11px] text-slate-400">{d.remarks}</span> : null}</td>
                <td className={`px-4 py-2.5 ${d.status === "unpaid" && d.overdue ? "text-rose-700" : d.status === "unpaid" && d.dueSoon ? "text-amber-700" : "text-slate-600"}`}>{d.dueDate}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(d.amount)}</td>
                <td className="px-4 py-2.5 capitalize">{d.status}{d.paidOn ? <span className="text-xs text-slate-400"> · {d.paidOn}</span> : null}</td>
                <td className="px-4 py-2.5 text-right">{d.status === "unpaid" && <MarkPaid id={d.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Meter readings (Meralco / water)</h2>
      <div className="mb-2"><MeterForm units={one} /></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Utility</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Reading</th><th className="px-4 py-3 text-right">Consumption</th></tr>
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
