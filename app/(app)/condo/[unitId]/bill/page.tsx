import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { condoBill } from "@/lib/condo/queries";
import { peso, todayManila } from "@/lib/collections/summary";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Condo Statement" };

export default async function CondoBillPage({ params }: { params: Promise<{ unitId: string }> }) {
  await requireModule("condo");
  const { unitId } = await params;
  const bill = await condoBill(unitId);
  if (!bill) notFound();
  const { unit, lines, total, bankAccount } = bill;

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={`/condo/${unitId}`} className="text-xs text-amber-700 hover:underline">← Back to unit</Link>
        <PrintButton label="Print statement" />
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-slate-300 pb-4">
          <div>
            <p className="text-lg font-bold text-slate-900">{APP_BRAND_SHORT}</p>
            <p className="text-sm text-slate-500">Condo Statement of Account</p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>Date: <strong>{todayManila()}</strong></p>
            <p className="text-slate-400">Unit {unit.unitNumber} · {unit.propertyName}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600">Association dues basis: {unit.areaSqm} sqm × ₱{unit.effectiveRate}/sqm</p>

        <table className="mt-4 w-full text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="py-2 text-left">Item</th><th className="py-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-slate-500">Nothing outstanding.</td></tr>}
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{l.label}{l.detail && <span className="ml-1 text-xs text-slate-400">({l.detail})</span>}</td>
                <td className="py-2 text-right tabular-nums">{peso(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="text-base font-bold"><td className="py-3">Total due</td><td className="py-3 text-right tabular-nums">{peso(total)}</td></tr></tfoot>
        </table>

        {bankAccount && <p className="mt-6 text-xs text-slate-500">Please deposit to the common-area fund account: <strong>{bankAccount}</strong>.</p>}
        <p className="mt-6 text-center text-[10px] text-slate-400">{APP_BRAND}</p>
      </div>
    </>
  );
}
