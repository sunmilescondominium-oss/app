import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { getHotelDaySummary } from "@/lib/hotel/queries";
import { todayManila, peso } from "@/lib/collections/summary";
import { HOTEL_PAYMENT_METHODS, APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Hotel Day-end" };

const METHOD_LABEL = Object.fromEntries(HOTEL_PAYMENT_METHODS.map((m) => [m.key, m.label]));

export default async function HotelDayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule("hotel");
  const sp = await searchParams;
  const date = (typeof sp.date === "string" && sp.date) || todayManila();
  const s = await getHotelDaySummary(date);

  const inputCls =
    "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <>
      <div className="no-print mb-4">
        <Link href="/hotel" className="text-sm font-medium text-amber-700 hover:underline">
          ← Room board
        </Link>
      </div>

      <PageHeader title="Hotel Day-end / Remittance" subtitle={`For ${date} (Manila)`} />

      <div className="mb-4 hidden print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Hotel Day-end / Remittance Report — {date}</p>
      </div>

      <form method="get" className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Date</label>
          <input type="date" name="date" defaultValue={date} className={inputCls} />
        </div>
        <button type="submit" className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900">
          View
        </button>
        <PrintButton label="Print report" />
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Check-ins", String(s.checkInCount)],
          ["Check-outs", String(s.checkOutCount)],
          ["Total hours", `${s.totalOccupiedHours}h`],
          ["Collections", peso(s.collectionsTotal)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className="text-2xl font-bold tabular-nums text-stone-900">{v}</p>
            <p className="text-xs text-stone-500">{k}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Remittance by method</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {s.byMethod.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-stone-500">
                  No collections for this date.
                </td>
              </tr>
            )}
            {s.byMethod.map((m) => (
              <tr key={m.method} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{METHOD_LABEL[m.method] ?? m.method}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(m.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-semibold">
              <td className="px-4 py-3">Total remittance ({s.paymentCount} payments)</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(s.collectionsTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DayList title="Check-ins" rows={s.checkIns.map((c) => ({ a: `${c.unit} · ${c.guest}`, b: new Date(c.at).toLocaleTimeString() }))} />
        <DayList
          title="Check-outs"
          rows={s.checkOuts.map((c) => ({ a: `${c.unit} · ${c.guest}`, b: `${new Date(c.at).toLocaleTimeString()} · ${c.hours}h` }))}
        />
      </div>

      <p className="mt-6 text-xs text-stone-400">
        Hotel payments post to Collections automatically, so this remittance is included in the daily transmittal.
      </p>
    </>
  );
}

function DayList({ title, rows }: { title: string; rows: { a: string; b: string }[] }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">None.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-stone-700">{r.a}</span>
              <span className="text-stone-500">{r.b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
