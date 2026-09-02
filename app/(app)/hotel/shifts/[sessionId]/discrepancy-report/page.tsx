import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { getCollectionDiscrepancyReport } from "@/lib/hotel/discrepancy-report";
import { APP_BRAND_SHORT } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discrepancy Report" };

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit",
  });
}

function fmtHrs(h: number) {
  return `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
}

const SEV_STYLE: Record<string, string> = {
  high: "border-rose-300 bg-rose-50 text-rose-900",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-emerald-200 bg-emerald-50 text-emerald-800",
};
const SEV_ICON: Record<string, string> = { high: "🚨", medium: "⚠️", low: "✓" };

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", gcash: "GCash", bank_transfer: "Bank Transfer",
  maya: "Maya", credit_card: "Credit Card", check: "Check", other: "Other",
};

export default async function DiscrepancyReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await requireModule("hotel");
  const isSupervisor = userHasAnyRole(user, [
    "hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting",
  ]);
  if (!isSupervisor) notFound();

  const data = await getCollectionDiscrepancyReport(sessionId);
  if (!data) notFound();

  const { session, stays, methodSplit, arGaps, findings, totalExpected, totalCollected, variance, totalShortfall, totalForcedCheckouts } = data;

  const hasVariance = Math.abs(variance) > 0.01;
  const forcedStays = stays.filter((s) => s.isForced);
  const unpaidStays = stays.filter((s) => !s.isForced && s.balance > 0.01);
  const cleanStays = stays.filter((s) => s.balance <= 0.01 && !s.isForced);
  const generatedAt = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Nav — hidden on print */}
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/hotel/shifts/${sessionId}/report`}
          className="text-sm font-medium text-amber-700 hover:underline"
        >
          ← Shift Report
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400">For monitoring use — confidential</span>
          <button
            type="button"
            onClick={undefined}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
            // eslint-disable-next-line react/no-unknown-property
            suppressHydrationWarning
          >
            Print
          </button>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: 'document.querySelectorAll("button").forEach(b => { if (b.textContent === "Print") b.onclick = () => window.print(); });' }} />

      <div className="space-y-6 pb-12 print:space-y-4">

        {/* ─── Report header ─── */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
          <div className="border-b border-stone-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 print:text-stone-500">
              {APP_BRAND_SHORT} · Hotel &amp; Rental Monitoring
            </p>
            <h1 className="mt-1 text-xl font-bold text-stone-900">Collection Discrepancy Report</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Prepared {generatedAt} · For discussion with cashier
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Cashier</p>
              <p className="font-semibold text-stone-800">{session.cashierName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Shift type</p>
              <p className="font-semibold text-stone-800 capitalize">{session.shiftType ?? "—"} shift</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Shift opened</p>
              <p className="text-sm text-stone-700">{fmt(session.openedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Shift closed</p>
              <p className="text-sm text-stone-700">{fmt(session.closedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">AR range assigned</p>
              <p className="font-mono text-sm text-stone-800">{session.beginningArNo} → {session.endingArNo}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">ARs issued</p>
              <p className="text-sm text-stone-700">{session.arCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Voided ARs</p>
              <p className="text-sm text-stone-700">{session.cancelledCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Report status</p>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${session.status === "acknowledged" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {session.status === "acknowledged" ? "Acknowledged" : "Pending acknowledgement"}
              </span>
            </div>
          </div>
        </div>

        {/* ─── KPI summary ─── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "System Expected", value: totalExpected, color: "text-stone-800" },
            { label: "Actually Collected", value: totalCollected, color: "text-stone-800" },
            {
              label: variance > 0 ? "Short by" : variance < 0 ? "Over by" : "Variance",
              value: Math.abs(variance),
              color: variance > 0.01 ? "text-rose-700 font-bold" : variance < -0.01 ? "text-amber-700 font-bold" : "text-emerald-700",
            },
            { label: "Force-checkout shortfalls", value: totalShortfall, color: totalShortfall > 0 ? "text-rose-700 font-bold" : "text-stone-500" },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">{k.label}</p>
              <p className={`mt-1 text-xl tabular-nums ${k.color}`}>{peso(k.value)}</p>
            </div>
          ))}
        </div>

        {/* ─── Initial Findings ─── */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Initial Findings</h2>
          <div className="space-y-2">
            {findings.map((f, i) => (
              <div key={i} className={`flex gap-3 rounded-xl border px-4 py-3 ${SEV_STYLE[f.severity]}`}>
                <span className="mt-0.5 text-base">{SEV_ICON[f.severity]}</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{f.category}</p>
                  <p className="mt-0.5 text-sm">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Payment method breakdown ─── */}
        {methodSplit.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Payment Method Breakdown</h2>
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <table className="w-full min-w-[400px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Count</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Share</th>
                    <th className="px-4 py-3">Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {methodSplit.map((m) => (
                    <tr key={m.method} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-stone-700">{METHOD_LABEL[m.method] ?? m.method}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">{m.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-stone-800">{peso(m.total)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">{m.pct}%</td>
                      <td className="px-4 py-2.5">
                        <div className="h-2 w-full max-w-[120px] rounded-full bg-stone-100">
                          <div
                            className={`h-2 rounded-full ${m.method === "cash" ? "bg-amber-500" : "bg-blue-400"}`}
                            style={{ width: `${Math.min(100, m.pct)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-stone-300 font-bold">
                  <tr>
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">{methodSplit.reduce((s, m) => s + m.count, 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-900">{peso(totalCollected)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ─── AR gaps ─── */}
        {arGaps.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Missing AR Numbers
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">{arGaps.length}</span>
            </h2>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="mb-2 text-xs text-rose-700">These AR numbers fall within the cashier&apos;s assigned range but do not appear in any recorded payment or voided AR log.</p>
              <div className="flex flex-wrap gap-2">
                {arGaps.map((ar) => (
                  <span key={ar} className="rounded-full border border-rose-300 bg-white px-2.5 py-0.5 font-mono text-xs text-rose-800">{ar}</span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ─── Forced checkouts ─── */}
        {forcedStays.length > 0 && (
          <section className="break-before-page">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Force-Checked-Out Stays
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">{forcedStays.length}</span>
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-rose-300 bg-white">
              <table className="w-full min-w-[740px] text-left text-sm">
                <thead className="border-b border-rose-200 bg-rose-50 text-[10px] uppercase tracking-wide text-rose-700">
                  <tr>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">In</th>
                    <th className="px-4 py-3">Out</th>
                    <th className="px-4 py-3 text-right">Charged</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Shortfall</th>
                    <th className="px-4 py-3">Cashier reason</th>
                  </tr>
                </thead>
                <tbody>
                  {forcedStays.map((s) => (
                    <tr key={s.stayId} className="border-b border-rose-100 last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-stone-800">{s.unitNumber}</td>
                      <td className="px-4 py-2.5 text-stone-700">{s.guestLabel}</td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">{fmtShort(s.checkInAt)}</td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">{s.checkOutAt ? fmtShort(s.checkOutAt) : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-stone-800">{peso(s.totalCharge)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{peso(s.totalPaid)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-rose-700">{peso(s.shortfallAmount ?? s.balance)}</td>
                      <td className="px-4 py-2.5 max-w-[200px] text-xs text-stone-600 italic">
                        {s.shortfallReason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-rose-300 font-bold">
                  <tr>
                    <td colSpan={4} className="px-4 py-2.5 text-rose-800">Totals</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-800">{peso(forcedStays.reduce((s, r) => s + r.totalCharge, 0))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{peso(forcedStays.reduce((s, r) => s + r.totalPaid, 0))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">{peso(totalShortfall)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ─── Unpaid balance stays (not forced) ─── */}
        {unpaidStays.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Stays with Unpaid Balance (Not Forced)
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{unpaidStays.length}</span>
            </h2>
            <p className="mb-2 text-xs text-stone-500">These stays show a balance in the system. Possible causes: payment collected but not entered, discrepancy in amount, or payment method mismatch.</p>
            <div className="overflow-x-auto rounded-2xl border border-amber-200 bg-white">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-amber-200 bg-amber-50 text-[10px] uppercase tracking-wide text-amber-700">
                  <tr>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3 text-right">Charged</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Method(s)</th>
                    <th className="px-4 py-3">AR</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidStays.map((s) => (
                    <tr key={s.stayId} className="border-b border-amber-100 last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-stone-800">{s.unitNumber}</td>
                      <td className="px-4 py-2.5 text-stone-700">{s.guestLabel}</td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">
                        {s.actualHours != null ? fmtHrs(s.actualHours) : `${s.plannedHours}h planned`}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-stone-800">{peso(s.totalCharge)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{peso(s.totalPaid)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-700">{peso(s.balance)}</td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">
                        {s.paymentMethods.map((m) => `${METHOD_LABEL[m.method] ?? m.method} ${peso(m.amount)}`).join(" + ") || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-stone-400">
                        {s.hasNoAr ? <span className="text-rose-600 font-semibold">No AR</span> : s.arNos.join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-amber-300 font-bold">
                  <tr>
                    <td colSpan={3} className="px-4 py-2.5 text-amber-800">Totals</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-800">{peso(unpaidStays.reduce((s, r) => s + r.totalCharge, 0))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">{peso(unpaidStays.reduce((s, r) => s + r.totalPaid, 0))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-700">{peso(unpaidStays.reduce((s, r) => s + r.balance, 0))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ─── All stays during shift (complete list) ─── */}
        <section className="break-before-page">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            All Stays This Shift ({stays.length})
          </h2>
          {stays.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-6 py-8 text-center text-sm text-stone-400">
              No stays recorded during this shift window.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">In</th>
                    <th className="px-4 py-3">Out</th>
                    <th className="px-4 py-3 text-right">Hrs</th>
                    <th className="px-4 py-3 text-right">Room</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Disc.</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stays.map((s) => {
                    const rowCls = s.isForced
                      ? "border-b border-rose-100 bg-rose-50/40"
                      : s.balance > 0.01
                      ? "border-b border-amber-100 bg-amber-50/30"
                      : "border-b border-stone-100";
                    return (
                      <tr key={s.stayId} className={rowCls}>
                        <td className="px-4 py-2 font-semibold text-stone-800">
                          <Link href={`/hotel/${s.stayId}`} className="hover:underline">{s.unitNumber}</Link>
                        </td>
                        <td className="px-4 py-2 max-w-[140px] truncate text-stone-700">{s.guestLabel}</td>
                        <td className="px-4 py-2 text-xs tabular-nums text-stone-500">{fmtShort(s.checkInAt)}</td>
                        <td className="px-4 py-2 text-xs tabular-nums text-stone-500">{s.checkOutAt ? fmtShort(s.checkOutAt) : <span className="text-amber-600">Active</span>}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-xs text-stone-500">{s.actualHours != null ? `${s.actualHours.toFixed(1)}h` : `${s.plannedHours}h`}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-700">{peso(s.roomCharge)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-500">{s.ordersTotal > 0 ? peso(s.ordersTotal) : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-400">{s.discount > 0 ? `-${peso(s.discount)}` : "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-stone-800">{peso(s.totalCharge)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-600">{peso(s.totalPaid)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums font-semibold ${s.balance > 0.01 ? "text-rose-700" : "text-emerald-600"}`}>
                          {s.balance > 0.01 ? peso(s.balance) : "—"}
                        </td>
                        <td className="px-4 py-2">
                          {s.isForced ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">Forced</span>
                          ) : s.balance > 0.01 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Unpaid</span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-stone-300 font-bold">
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-stone-700">{stays.length} stays</td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-800">{peso(stays.reduce((s, r) => s + r.roomCharge, 0))}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">{peso(stays.reduce((s, r) => s + r.ordersTotal, 0))}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-400">{stays.some((s) => s.discount > 0) ? `-${peso(stays.reduce((s, r) => s + r.discount, 0))}` : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-900">{peso(stays.reduce((s, r) => s + r.totalCharge, 0))}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-700">{peso(stays.reduce((s, r) => s + r.totalPaid, 0))}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-rose-700">{stays.some((s) => s.balance > 0.01) ? peso(stays.reduce((s, r) => s + Math.max(0, r.balance), 0)) : "—"}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* ─── Discussion notes (blank on print) ─── */}
        <section className="break-before-page">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Discussion Notes</h2>
          <div className="rounded-2xl border border-stone-300 bg-white p-4 print:min-h-[120px]">
            <p className="text-xs text-stone-400 print:hidden">
              Use this section during the cashier discussion to record the cashier&apos;s explanation and any agreed actions.
            </p>
            <div className="mt-3 hidden space-y-4 print:block">
              {["Cashier's explanation", "Agreed action / resolution", "Reviewed by (name + signature)"].map((label) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
                  <div className="mt-4 border-b border-stone-400" />
                  <div className="mt-4 border-b border-stone-400" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <p className="text-center text-[10px] text-stone-400 print:mt-8">
          {APP_BRAND_SHORT} · Collection Discrepancy Report · {session.cashierName} · {fmt(session.openedAt)} – {fmt(session.closedAt)} · Printed {generatedAt}
        </p>
      </div>
    </>
  );
}
