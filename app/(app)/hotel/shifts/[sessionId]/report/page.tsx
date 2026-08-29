import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getShiftReport } from "@/lib/hotel/session";
import { canWriteModule } from "@/lib/rbac/modules";
import { AcknowledgeForm } from "./acknowledge-form";
import { DiscrepancyReasonForm } from "./discrepancy-reason-form";
import { CorrectionsPanel } from "./corrections-panel";
import type { ExtensionDetail } from "@/lib/hotel/extension";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shift Report" };

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit",
  });
}

export default async function ShiftReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireModule("hotel");
  const { sessionId } = await params;
  const report = await getShiftReport(sessionId);
  if (!report) notFound();

  const isSupervisor = user.roleKeys.some((r) =>
    ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"].includes(r)
  );
  const canAck = canWriteModule(user.roleKeys, "hotel") && isSupervisor;
  const isCashier = user.roleKeys.includes("hotel_cashier");

  const hasDiscrepancy = report.discrepancyAmount != null && report.discrepancyAmount !== 0;
  const extensions = (report.extensionDetailsJson as ExtensionDetail[]).filter(Boolean);
  const hasExtensions = extensions.some((e) => e.extHours > 0);

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <p className="text-xs text-stone-400">Hotel / Shifts</p>
          <h1 className="text-lg font-bold text-stone-900">Cashier Shift Report</h1>
        </div>
        <a href="javascript:window.print()" className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 print:hidden">
          Print / Save PDF
        </a>
      </div>

      {/* Discrepancy alert — prominent, shown before the report */}
      {hasDiscrepancy && (
        <div className={`mb-4 rounded-xl border px-4 py-3 print:hidden ${report.discrepancyReason ? "border-amber-200 bg-amber-50" : "border-rose-300 bg-rose-50"}`}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">{report.discrepancyReason ? "⚠" : "🚨"}</span>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${report.discrepancyReason ? "text-amber-900" : "text-rose-900"}`}>
                Collection discrepancy detected
              </p>
              <p className={`text-xs ${report.discrepancyReason ? "text-amber-800" : "text-rose-800"}`}>
                System expected {peso(report.expectedCollection ?? 0)} · Actual collected {peso(report.totalCollected)} ·{" "}
                <strong>{report.discrepancyAmount! > 0 ? `Short by ${peso(report.discrepancyAmount!)}` : `Over by ${peso(Math.abs(report.discrepancyAmount!))}`}</strong>
              </p>
              {report.discrepancyReason && (
                <p className="mt-1 text-xs text-amber-700">
                  <strong>Cashier reason:</strong> {report.discrepancyReason}
                </p>
              )}
            </div>
          </div>

          {/* Cashier submits reason if not yet given */}
          {hasDiscrepancy && !report.discrepancyReason && isCashier && (
            <div className="mt-3">
              <DiscrepancyReasonForm reportId={report.id} />
            </div>
          )}
          {hasDiscrepancy && !report.discrepancyReason && !isCashier && (
            <p className="mt-2 text-xs text-rose-700">
              Waiting for the cashier to submit a reason for this discrepancy.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-6 print:border-0 print:shadow-none">
        {/* Header block */}
        <div className="border-b border-stone-100 pb-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Cashier</p>
              <p className="font-semibold text-stone-800">{report.cashierName}</p>
              {report.shiftType && (
                <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  report.shiftType === "day"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-indigo-100 text-indigo-800"
                }`}>
                  {report.shiftType === "day" ? "☀ Day Shift" : "🌙 Night Shift"}
                </span>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Shift opened</p>
              <p className="text-sm text-stone-700">{fmt(report.openedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Shift closed</p>
              <p className="text-sm text-stone-700">{fmt(report.closedAt)}</p>
              {report.closedBySupervisor && <p className="text-[10px] text-amber-600">Force-closed by supervisor</p>}
            </div>
            {report.collectionStartsAt && report.collectionEndsAt && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-[10px] uppercase tracking-wide text-stone-400">Collection window</p>
                <p className="text-sm text-stone-700">
                  {fmtTime(report.collectionStartsAt)} – {fmtTime(report.collectionEndsAt)}
                  <span className="ml-2 text-[10px] text-stone-400">(20-min handover cutoff)</span>
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">AR range</p>
              <p className="font-mono text-sm text-stone-800">{report.beginningArNo} → {report.endingArNo}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">ARs issued</p>
              <p className="text-sm text-stone-700">{report.arCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Voided ARs</p>
              <p className="text-sm text-stone-700">{report.cancelledCount}</p>
            </div>

            {/* Expected vs Actual summary */}
            {report.expectedCollection != null && (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">System expected</p>
                  <p className="text-sm font-semibold text-stone-800">{peso(report.expectedCollection)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Actual collected</p>
                  <p className="text-sm font-semibold text-stone-800">{peso(report.totalCollected)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Variance</p>
                  <p className={`text-sm font-semibold ${hasDiscrepancy ? (report.discrepancyAmount! > 0 ? "text-rose-700" : "text-amber-700") : "text-emerald-700"}`}>
                    {!hasDiscrepancy ? "✓ Exact match" : report.discrepancyAmount! > 0 ? `− ${peso(report.discrepancyAmount!)}` : `+ ${peso(Math.abs(report.discrepancyAmount!))}`}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Extension hour table */}
        {extensions.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-stone-700">
              Room Usage &amp; Extension Hours
              <span className="ml-2 text-xs font-normal text-stone-400">(15-min grace · then billed per hour)</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Room</th>
                    <th className="px-3 py-2">Guest</th>
                    <th className="px-3 py-2">Check-in</th>
                    <th className="px-3 py-2">Check-out</th>
                    <th className="px-3 py-2 text-right">Planned hrs</th>
                    <th className="px-3 py-2 text-right">Ext hrs</th>
                    <th className="px-3 py-2 text-right">Base fee</th>
                    <th className="px-3 py-2 text-right">Ext charge</th>
                    <th className="px-3 py-2 text-right">Total expected</th>
                  </tr>
                </thead>
                <tbody>
                  {extensions.map((e, i) => (
                    <tr key={i} className={`border-t border-stone-100 ${e.extHours > 0 ? "bg-amber-50/60" : ""}`}>
                      <td className="px-3 py-2 font-medium">{e.unitNumber}</td>
                      <td className="px-3 py-2">{e.guestLabel}</td>
                      <td className="px-3 py-2 text-stone-400">{fmtTime(e.checkInAt)}</td>
                      <td className="px-3 py-2 text-stone-400">{fmtTime(e.checkOutAt)}</td>
                      <td className="px-3 py-2 text-right">{e.plannedHours}h</td>
                      <td className={`px-3 py-2 text-right font-semibold ${e.extHours > 0 ? "text-amber-700" : "text-stone-400"}`}>
                        {e.extHours > 0 ? `+${e.extHours}h` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{peso(e.baseAmount)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${e.extHours > 0 ? "text-amber-700" : "text-stone-300"}`}>
                        {e.extHours > 0 ? peso(e.extAmount) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{peso(e.totalExpected)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-stone-300 font-bold">
                  <tr>
                    <td colSpan={6} className="px-3 py-2">System total expected</td>
                    <td className="px-3 py-2 text-right tabular-nums">{peso(extensions.reduce((s, e) => s + e.baseAmount, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                      {hasExtensions ? peso(extensions.reduce((s, e) => s + e.extAmount, 0)) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-800">
                      {peso(extensions.reduce((s, e) => s + e.totalExpected, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Payments collected */}
        <div className="mt-6">
          {/* When collection window is present, split into in-window vs post-cutoff */}
          {report.collectionEndsAt ? (
            <>
              {/* In-window payments */}
              <div className="mb-1 flex items-center gap-2">
                <p className="text-sm font-semibold text-stone-700">My Collection</p>
                {report.collectionStartsAt && (
                  <span className="text-[10px] text-stone-400">
                    {fmtTime(report.collectionStartsAt)} – {fmtTime(report.collectionEndsAt)}
                  </span>
                )}
                {report.preCutoffTotal != null && (
                  <span className="ml-auto text-sm font-semibold tabular-nums text-emerald-700">
                    {peso(report.preCutoffTotal)}
                  </span>
                )}
              </div>
              {(report.preCutoffCount ?? 0) === 0 ? (
                <p className="text-xs text-stone-400 mb-4">No payments in your collection window.</p>
              ) : (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="px-3 py-2">AR #</th>
                        <th className="px-3 py-2">Guest</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.paymentsJson
                        .filter(p => p.paidAt < report.collectionEndsAt!)
                        .map((p, i) => (
                          <tr key={i} className="border-b border-stone-100 last:border-0">
                            <td className="px-3 py-2 font-mono text-xs">{p.arNo ?? "—"}</td>
                            <td className="px-3 py-2">{p.guest}</td>
                            <td className="px-3 py-2 capitalize">{p.method}</td>
                            <td className="px-3 py-2 text-xs text-stone-400">{fmt(p.paidAt)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{peso(p.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-stone-300 font-bold">
                        <td colSpan={4} className="px-3 py-2">Subtotal — my window</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{peso(report.preCutoffTotal ?? 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Post-cutoff payments (handed to next shift) */}
              {(report.postCutoffCount ?? 0) > 0 && (
                <>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-sm font-semibold text-amber-800">Processed for Next Shift</p>
                    <span className="text-[10px] text-stone-400">
                      after {fmtTime(report.collectionEndsAt)} — counted in incoming cashier&apos;s total
                    </span>
                    <span className="ml-auto text-sm font-semibold tabular-nums text-amber-700">
                      {peso(report.postCutoffTotal ?? 0)}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="border-b border-amber-200 bg-amber-50 text-[10px] uppercase tracking-wide text-amber-600">
                        <tr>
                          <th className="px-3 py-2">AR #</th>
                          <th className="px-3 py-2">Guest</th>
                          <th className="px-3 py-2">Method</th>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.postCutoffPaymentsJson.map((p, i) => (
                          <tr key={i} className="border-b border-amber-100 last:border-0 bg-amber-50/40">
                            <td className="px-3 py-2 font-mono text-xs">{p.arNo ?? "—"}</td>
                            <td className="px-3 py-2">{p.guest}</td>
                            <td className="px-3 py-2 capitalize">{p.method}</td>
                            <td className="px-3 py-2 text-xs text-stone-400">{fmt(p.paidAt)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{peso(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-amber-300 font-bold">
                          <td colSpan={4} className="px-3 py-2 text-amber-800">Subtotal — next shift</td>
                          <td className="px-3 py-2 text-right tabular-nums text-amber-700">{peso(report.postCutoffTotal ?? 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {/* Grand total row */}
              <div className="mt-3 flex justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-2">
                <span className="text-sm font-semibold text-stone-700">Total cash handled this session</span>
                <span className="text-sm font-bold tabular-nums text-stone-900">{peso(report.totalCollected)}</span>
              </div>
            </>
          ) : (
            /* No collection window data (legacy reports) — show single table */
            <>
              <p className="mb-2 text-sm font-semibold text-stone-700">Payments Collected</p>
              {report.paymentsJson.length === 0 ? (
                <p className="text-xs text-stone-400">No payments recorded during this shift.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="px-3 py-2">AR #</th>
                        <th className="px-3 py-2">Guest</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.paymentsJson.map((p, i) => (
                        <tr key={i} className="border-b border-stone-100 last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">{p.arNo ?? "—"}</td>
                          <td className="px-3 py-2">{p.guest}</td>
                          <td className="px-3 py-2 capitalize">{p.method}</td>
                          <td className="px-3 py-2 text-xs text-stone-400">{fmt(p.paidAt)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{peso(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-stone-300 font-bold">
                        <td colSpan={4} className="px-3 py-2">Total collected</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{peso(report.totalCollected)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cancelled ARs */}
        {report.cancelledArsJson.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-stone-700">Voided / Cancelled ARs</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-rose-50 text-[10px] uppercase tracking-wide text-rose-500">
                  <tr>
                    <th className="px-3 py-2">AR #</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Logged at</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cancelledArsJson.map((c, i) => (
                    <tr key={i} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{c.arNo}</td>
                      <td className="px-3 py-2 text-stone-600">{c.reason}</td>
                      <td className="px-3 py-2 text-xs text-stone-400">{fmt(c.loggedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Monitoring corrections panel */}
        {canAck && (
          <div className="mt-6 border-t border-stone-100 pt-4 print:hidden">
            <p className="mb-3 text-sm font-semibold text-stone-700">
              Monitoring Corrections
              {report.corrections.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
                  {report.corrections.length} correction{report.corrections.length !== 1 ? "s" : ""} made
                </span>
              )}
            </p>
            <CorrectionsPanel report={{ id: report.id, paymentsJson: report.paymentsJson, corrections: report.corrections }} />
          </div>
        )}

        {/* Acknowledgement */}
        <div className="mt-6 border-t border-stone-100 pt-4">
          {report.status === "acknowledged" ? (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm">
              <p className="font-semibold text-emerald-800">Acknowledged by {report.acknowledgedByName}</p>
              <p className="text-emerald-700">{report.acknowledgedAt ? fmt(report.acknowledgedAt) : ""}</p>
              {report.acknowledgedNotes && <p className="mt-1 text-emerald-700">{report.acknowledgedNotes}</p>}
            </div>
          ) : canAck ? (
            <div className="print:hidden">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Acknowledge this report</p>
              {hasDiscrepancy && !report.discrepancyReason && (
                <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⚠ The cashier has not yet submitted a discrepancy reason. You may still acknowledge, but this should be resolved first.
                </p>
              )}
              <AcknowledgeForm reportId={report.id} />
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
              Pending acknowledgement by Hotel &amp; Rental Monitoring / Accounting.
            </p>
          )}
        </div>

        {/* Signature block for print */}
        <div className="mt-8 hidden print:grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs text-stone-500">Prepared by (Cashier)</p>
            <div className="mt-6 border-t border-stone-800 pt-1">
              <p className="text-xs text-stone-700">{report.cashierName}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-stone-500">Received by (Hotel &amp; Rental Monitoring)</p>
            <div className="mt-6 border-t border-stone-800 pt-1">
              <p className="text-xs text-stone-400">Signature over printed name</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
