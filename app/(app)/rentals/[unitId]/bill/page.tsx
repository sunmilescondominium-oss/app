import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { unitBill } from "@/lib/rentals/queries";
import { peso, todayManila } from "@/lib/collections/summary";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Monthly Bill" };

export default async function RentalBillPage({ params }: { params: Promise<{ unitId: string }> }) {
  await requireModule("rentals");
  const { unitId } = await params;
  const bill = await unitBill(unitId);
  if (!bill) notFound();
  const { unit, lines, total } = bill;

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={`/rentals/${unitId}`} className="text-xs text-amber-700 hover:underline">← Back to unit</Link>
        <PrintButton label="Print bill" />
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-stone-300 pb-4">
          <div>
            <p className="text-lg font-bold text-stone-900">{APP_BRAND_SHORT}</p>
            <p className="text-sm text-stone-500">Statement of Account — Monthly Bill</p>
          </div>
          <div className="text-right text-sm text-stone-600">
            <p>Date: <strong>{todayManila()}</strong></p>
            <p className="text-stone-400">Unit {unit.unitNumber} · {unit.businessLine}</p>
          </div>
        </div>

        <div className="mt-4 text-sm">
          <p><span className="text-stone-400">Billed to:</span> <strong>{unit.lease?.tenantLabel ?? "—"}</strong></p>
          {unit.lease?.contact && <p className="text-stone-500">{unit.lease.contact}</p>}
          <p className="text-stone-500">{unit.propertyName}</p>
        </div>

        <table className="mt-5 w-full text-sm">
          <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-2 text-left">Item</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={2} className="py-4 text-center text-stone-500">Nothing outstanding.</td></tr>
            )}
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-stone-100">
                <td className="py-2">
                  {l.label}
                  {l.detail && <span className="ml-1 text-xs text-stone-400">({l.detail})</span>}
                </td>
                <td className="py-2 text-right tabular-nums">{peso(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-base font-bold">
              <td className="py-3">Total due</td>
              <td className="py-3 text-right tabular-nums">{peso(total)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 text-xs text-stone-400">
          Please settle on or before the due date. Electricity (Meralco) and water charges are billed as posted.
        </p>
        <p className="mt-6 text-center text-[10px] text-stone-400">{APP_BRAND}</p>
      </div>

      <p className="no-print mt-3 text-center text-xs text-stone-400">
        This statement will also be sent by email &amp; SMS once notifications are enabled.
      </p>
    </>
  );
}
