import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { condoUnits, getCondoSettings, propertyRates, currentMonth } from "@/lib/condo/queries";
import { peso } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";
import { CondoSettingsForm, PropertyRates, GenerateDues, UnitRateOverride } from "@/components/condo/condo-forms";

export const metadata = { title: "Condo Dues" };

export default async function CondoPage() {
  await requireModule("condo");
  const [units, settings, props] = await Promise.all([condoUnits(), getCondoSettings(), propertyRates()]);

  return (
    <>
      <PageHeader
        backHref="/dashboard" title="Condo Dues" subtitle="Association dues (area × rate), utilities & billing — common-area fund." />

      <div className="mt-4 space-y-3">
        <CondoSettingsForm defaultRate={settings.defaultRate} bankAccount={settings.bankAccount} dueDay={settings.dueDay} />
        <div className="grid gap-3 lg:grid-cols-2">
          <PropertyRates properties={props} />
          <GenerateDues month={currentMonth()} />
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">Condo units</h2>
      <div className="table-wrap">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Area (sqm)</th>
              <th className="px-4 py-3 text-right">Rate ₱/sqm</th>
              <th className="px-4 py-3">Unit override</th>
              <th className="px-4 py-3 text-right">Monthly dues</th>
              <th className="px-4 py-3 text-right">Unpaid</th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">No condo units. Add condo units in Inventory (business line = condo sales) with an area.</td></tr>}
            {units.map((u) => (
              <tr key={u.unitId} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">
                  <Link href={`/condo/${u.unitId}`} className="font-medium text-amber-700 hover:underline">{u.unitNumber}</Link>
                  <span className="ml-1 text-xs text-stone-400">{u.propertyName}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{u.areaSqm || "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{u.effectiveRate}</td>
                <td className="px-4 py-2.5"><UnitRateOverride unitId={u.unitId} value={u.effectiveRate === (props.find((p) => p.id === u.propertyId)?.rate ?? settings.defaultRate) ? null : u.effectiveRate} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(u.monthlyDues)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${u.unpaidTotal > 0 ? "text-rose-700" : "text-stone-400"}`}>{u.unpaidTotal ? peso(u.unpaidTotal) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {settings.bankAccount && <p className="mt-2 text-xs text-stone-400">Common-area fund account: <strong>{settings.bankAccount}</strong> — deposit condo collections here, separate from operating.</p>}
    </>
  );
}
