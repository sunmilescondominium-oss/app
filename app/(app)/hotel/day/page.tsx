import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { getHotelDaySummary } from "@/lib/hotel/queries";
import { getShiftHandover, listHotelCollectionsForDate, getHotelShiftTransmittalId } from "@/lib/hotel/handover";
import { todayManila, peso } from "@/lib/collections/summary";
import { getActiveItemTypes } from "@/lib/collections/item-types";
import { HOTEL_PAYMENT_METHODS, APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ShiftHandoverForm } from "@/components/hotel/shift-handover-form";
import { ShiftTransmittalForm } from "@/components/hotel/shift-transmittal-form";

export const metadata = { title: "Hotel Day-end" };

const METHOD_LABEL = Object.fromEntries(HOTEL_PAYMENT_METHODS.map((m) => [m.key, m.label]));

export default async function HotelDayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("hotel");
  const sp = await searchParams;
  const date = (typeof sp.date === "string" && sp.date) || todayManila();

  const isCashier = user.roleKeys.includes("hotel_cashier");
  const isMonitoring = user.roleKeys.some((r) =>
    ["hotel_rental_monitoring", "admin", "managing_officer", "consultant"].includes(r),
  );

  const [s, handover, hotelCols, itemTypes] = await Promise.all([
    getHotelDaySummary(date),
    getShiftHandover(date),
    (isCashier || isMonitoring) ? listHotelCollectionsForDate(date) : Promise.resolve([]),
    getActiveItemTypes(),
  ]);
  const itemTypeLabels = Object.fromEntries(itemTypes.map((t) => [t.key, t.label]));

  // Check if a hotel-shift transmittal has already been built for this handover
  const existingTransmittalId =
    isMonitoring && handover ? await getHotelShiftTransmittalId(handover.id) : null;
  const alreadyTransmitted = !!existingTransmittalId;

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

      {/* Summary tiles */}
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

      {/* Remittance by payment method */}
      <div className="mb-6 table-wrap">
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

      {/* Check-in / check-out lists */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <DayList title="Check-ins" rows={s.checkIns.map((c) => ({ a: `${c.unit} · ${c.guest}`, b: new Date(c.at).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" }) }))} />
        <DayList
          title="Check-outs"
          rows={s.checkOuts.map((c) => ({ a: `${c.unit} · ${c.guest}`, b: `${new Date(c.at).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" })} · ${c.hours}h` }))}
        />
      </div>

      {/* ── Shift handover section ── */}
      <div className="no-print mb-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Shift collection handover
        </h2>

        {/* Cashier: my shift collections summary */}
        {isCashier && hotelCols.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <div className="border-b border-stone-100 px-4 py-2.5 flex items-center justify-between bg-stone-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">My shift collections</p>
              <span className="text-xs text-stone-400">{hotelCols.length} entries · {peso(hotelCols.reduce((s, c) => s + c.amount, 0))}</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-100 text-stone-400 uppercase">
                <tr>
                  <th className="px-4 py-2">Room</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">OR #</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {hotelCols.map((c) => (
                  <tr key={c.id} className="border-t border-stone-50">
                    <td className="px-4 py-1.5 font-medium text-stone-700">{c.unit_number ?? "—"}</td>
                    <td className="px-4 py-1.5 text-stone-500">{c.charge_type ? (itemTypeLabels[c.charge_type] ?? c.charge_type) : "—"}</td>
                    <td className="px-4 py-1.5 font-mono">{c.or_number ?? "—"}</td>
                    <td className="px-4 py-1.5">{METHOD_LABEL[c.payment_type] ?? c.payment_type}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{peso(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cashier: submit handover */}
        {isCashier && (
          <ShiftHandoverForm date={date} existing={handover} isMonitoring={false} />
        )}

        {/* Monitoring covering for absent cashier (before they build the transmittal) */}
        {isMonitoring && !handover && (
          <ShiftHandoverForm date={date} existing={null} isMonitoring={true} />
        )}

        {/* Monitoring: show handover status + build transmittal */}
        {isMonitoring && (
          <>
            {handover && (
              <ShiftHandoverForm date={date} existing={handover} isMonitoring={true} />
            )}

            {alreadyTransmitted ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
                <p className="text-sm font-semibold text-emerald-900">
                  ✓ Hotel shift transmittal for {date} has been built.
                </p>
                <Link
                  href={existingTransmittalId ? `/transmittals/${existingTransmittalId}` : "/transmittals"}
                  className="text-sm text-amber-700 hover:underline"
                >
                  View transmittal →
                </Link>
              </div>
            ) : (
              <ShiftTransmittalForm
                date={date}
                handover={handover}
                collections={hotelCols}
                itemTypeLabels={itemTypeLabels}
              />
            )}
          </>
        )}
      </div>

      <p className="text-xs text-stone-400">
        Hotel payments post to Collections automatically. This remittance is included in the hotel shift transmittal built by Hotel &amp; Rental Monitoring.
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
