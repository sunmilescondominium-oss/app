import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getShiftReport } from "@/lib/hotel/session";
import { canWriteModule } from "@/lib/rbac/modules";
import { AcknowledgeForm } from "./acknowledge-form";

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

export default async function ShiftReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireModule("hotel");
  const { sessionId } = await params;
  const report = await getShiftReport(sessionId);
  if (!report) notFound();

  const canAck = canWriteModule(user.roleKeys, "hotel") &&
    user.roleKeys.some((r) => ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"].includes(r));

  return (
    <>
      {/* Print header — shown only on screen */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <p className="text-xs text-stone-400">Hotel / Shifts</p>
          <h1 className="text-lg font-bold text-stone-900">Cashier Shift Report</h1>
        </div>
        <button onClick={() => undefined} className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 print:hidden"
          /* JS onClick won't work in server component — use a link instead */
        />
        <a href="javascript:window.print()" className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 print:hidden">
          Print / Save PDF
        </a>
      </div>

      {/* Report card */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 print:border-0 print:shadow-none">
        {/* Header block */}
        <div className="border-b border-stone-100 pb-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Cashier</p>
              <p className="font-semibold text-stone-800">{report.cashierName}</p>
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
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">AR range</p>
              <p className="font-mono text-sm text-stone-800">{report.beginningArNo} → {report.endingArNo}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">ARs issued</p>
              <p className="text-sm text-stone-700">{report.arCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Voided</p>
              <p className="text-sm text-stone-700">{report.cancelledCount}</p>
            </div>
          </div>
        </div>

        {/* Payments collected */}
        <div className="mt-4">
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
