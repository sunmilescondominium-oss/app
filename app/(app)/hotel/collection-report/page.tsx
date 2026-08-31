import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { listHotelCollectionReport } from "@/lib/hotel/collection-report";
import { PrintButton } from "@/components/guard/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hotel Collection Report" };

const ALLOWED = [
  "hotel_rental_monitoring", "admin", "managing_officer",
  "consultant", "accounting", "hotel_cashier",
] as const;

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric",
  });
}
function todayManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

const METHOD: Record<string, string> = {
  cash: "Cash", gcash: "GCash", maya: "Maya", bank_transfer: "Bank",
};
const STATUS_BADGE: Record<string, string> = {
  active:      "bg-emerald-100 text-emerald-800",
  checked_out: "bg-stone-100 text-stone-600",
};
const STATUS_LABEL: Record<string, string> = {
  active:      "Checked In",
  checked_out: "Checked Out",
};

export default async function HotelCollectionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...ALLOWED]))
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;

  const sp = await searchParams;
  const date = sp.date || todayManila();

  const entries = await listHotelCollectionReport(date);

  const grandTotal = entries.reduce((s, e) => s + e.totalCharge, 0);
  const grandPaid  = entries.reduce((s, e) => s + e.totalPaid, 0);
  const grandBalance = entries.reduce((s, e) => s + e.balance, 0);

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="Hotel Collection Report"
        subtitle={`Room-by-room charges, incidentals & payments · ${fmtDate(date + "T00:00:00+08:00")}`}
      />

      {/* Filter + actions */}
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <form method="get" className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Date</label>
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            View →
          </button>
        </form>
        <PrintButton />
      </div>

      {/* Summary row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-stone-900">{entries.length}</p>
          <p className="text-xs text-stone-500">Rooms / stays</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-emerald-800">{peso(grandPaid)}</p>
          <p className="text-xs text-stone-500">Total collected</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-stone-900">{peso(grandTotal)}</p>
          <p className="text-xs text-stone-500">Total charges</p>
        </div>
        {grandBalance > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-2xl font-bold tabular-nums text-amber-800">{peso(grandBalance)}</p>
            <p className="text-xs text-amber-700">Outstanding balance</p>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-400">
          No stays recorded for this date.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <div
              key={e.stayId}
              className={`overflow-hidden rounded-2xl border bg-white ${e.balance > 0 ? "border-amber-200" : "border-stone-200"}`}
            >
              {/* Room header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-stone-50/60 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-amber-100 px-2.5 py-0.5 font-mono text-sm font-bold text-amber-900">
                    {e.unitNumber}
                  </span>
                  <span className="text-sm font-semibold text-stone-800">{e.guestLabel}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[e.status] ?? "bg-stone-100 text-stone-500"}`}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                {/* Time period */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-500">
                  <span>
                    <span className="text-stone-400">In:</span>{" "}
                    <strong className="text-stone-700">{fmtTime(e.checkedInAt)}</strong>
                  </span>
                  {e.checkedOutAt ? (
                    <span>
                      <span className="text-stone-400">Out:</span>{" "}
                      <strong className="text-stone-700">{fmtTime(e.checkedOutAt)}</strong>
                    </span>
                  ) : (
                    <span className="font-semibold text-emerald-700">Still inside</span>
                  )}
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-stone-600">
                    {e.checkedOutAt && e.actualHours != null
                      ? `${e.actualHours}h actual`
                      : `${e.plannedHours}h planned`}
                  </span>
                </div>
              </div>

              <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
                {/* Itemized charges */}
                <div className="px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Itemized charges</p>
                  <div className="space-y-1">
                    {/* Room rate */}
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-stone-600">
                        Room charge
                        <span className="ml-1 text-xs text-stone-400">
                          ({e.plannedHours}h)
                        </span>
                      </span>
                      <span className="tabular-nums font-medium text-stone-800">{peso(e.roomChargeAmount)}</span>
                    </div>
                    {/* Extra persons at check-in */}
                    {e.extraPersonTotal > 0 && (
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-stone-600">
                          Extra persons at check-in
                          {e.extraPersonsQty > 0 && (
                            <span className="ml-1 text-xs text-stone-400">({e.extraPersonsQty}×)</span>
                          )}
                        </span>
                        <span className="tabular-nums font-medium text-stone-800">{peso(e.extraPersonTotal)}</span>
                      </div>
                    )}
                    {/* Orders / incidentals */}
                    {e.orders.map((o, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-stone-600">
                          {o.isExtraPerson ? "Extra person added" : o.name}
                          <span className="ml-1 text-xs text-stone-400">
                            {o.qty}× {peso(o.unitPrice)}
                          </span>
                        </span>
                        <span className="tabular-nums font-medium text-stone-800">{peso(o.amount)}</span>
                      </div>
                    ))}
                    {/* Discount */}
                    {e.discountAmount > 0 && (
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-rose-600">Discount</span>
                        <span className="tabular-nums font-medium text-rose-600">−{peso(e.discountAmount)}</span>
                      </div>
                    )}
                    {/* Total */}
                    <div className="flex items-baseline justify-between gap-2 border-t border-stone-200 pt-1.5 text-sm font-bold text-stone-900">
                      <span>Total charge</span>
                      <span className="tabular-nums">{peso(e.totalCharge)}</span>
                    </div>
                  </div>
                </div>

                {/* Payments */}
                <div className="border-t border-stone-100 px-4 py-3 sm:border-l sm:border-t-0 sm:min-w-[200px]">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Payments received</p>
                  {e.payments.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No payments yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {e.payments.map((p, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-stone-600">{METHOD[p.method] ?? p.method}</span>
                            <span className="tabular-nums font-semibold text-stone-800">{peso(p.amount)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-stone-400">
                            <span>{fmtTime(p.paidAt)}</span>
                            {p.arNo && <span className="font-mono">{p.arNo}</span>}
                            {p.orNo && <span className="font-mono">{p.orNo}</span>}
                            {p.collectorName && <span>{p.collectorName}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Balance */}
                  <div className={`mt-2 flex items-baseline justify-between gap-2 border-t border-stone-200 pt-1.5 text-sm font-bold ${e.balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    <span>{e.balance > 0 ? "Balance due" : "Settled"}</span>
                    <span className="tabular-nums">{e.balance > 0 ? peso(e.balance) : "✓"}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grand total footer */}
      {entries.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <span className="text-sm font-semibold text-stone-600">{entries.length} room{entries.length !== 1 ? "s" : ""} · {fmtDate(date + "T00:00:00+08:00")}</span>
          <div className="flex items-center gap-6 text-sm font-bold text-stone-800">
            {grandBalance > 0 && (
              <span className="text-amber-700">Balance {peso(grandBalance)}</span>
            )}
            <span>Collected {peso(grandPaid)}</span>
            <span>Total charges {peso(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* Print footer */}
      <div className="print-only mt-8 border-t border-stone-300 pt-4 text-xs text-stone-500">
        <p>Hotel Collection Report · {fmtDate(date + "T00:00:00+08:00")} · Printed {new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
        <p className="mt-4">Prepared by: _________________________________ Date: _____________</p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>
    </>
  );
}
