import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import {
  getActiveSession,
  getSessionHistory,
  getSessionSummary,
  getSuggestedNextArNo,
} from "@/lib/hotel/session";
import { OpenShiftForm } from "./open-shift-form";
import { CloseShiftForm } from "./close-shift-form";
import { CancelArForm } from "./cancel-ar-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cashier Shifts" };

const SUPERVISOR = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant"] as const;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "short", timeStyle: "short" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

export default async function ShiftsPage() {
  const user = await requireAuth();
  const allowed = userHasAnyRole(user, ["hotel_cashier", ...SUPERVISOR]);
  if (!allowed) return <p className="p-8 text-sm text-stone-500">Access denied.</p>;

  const isSupervisor = userHasAnyRole(user, [...SUPERVISOR]);
  const isCashier    = userHasAnyRole(user, ["hotel_cashier"]);

  const [active, suggested, history] = await Promise.all([
    getActiveSession(),
    getSuggestedNextArNo(),
    getSessionHistory(10),
  ]);

  const activeDetail = active ? await getSessionSummary(active.id) : null;
  const isOnDuty = active?.cashierUserId === user.userId;

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="Cashier Shifts"
        subtitle="Open and close your shift, declare AR numbers, and log cancellations."
      />

      {/* ── Active session banner ───────────────────────────────────────────── */}
      {active ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                🟢 {active.cashierName} is on duty
              </p>
              <p className="text-xs text-amber-700">
                Shift opened {fmt(active.openedAt)} · Beginning AR: <strong>{active.beginningArNo}</strong>
              </p>
            </div>
            {isOnDuty && (
              <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">
                You are on duty
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-600">⚪ No cashier on duty</p>
          <p className="text-xs text-stone-400 mt-0.5">
            Hotel check-in, check-out, and payments are locked until a cashier opens their shift.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Left: action panel ────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Open shift */}
          {!active && (isCashier || isSupervisor) && (
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-stone-800">Open Shift</p>
              <p className="mb-3 text-xs text-stone-500">
                Enter your beginning AR number from the physical booklet. Suggested next: <strong>{suggested}</strong>
              </p>
              <OpenShiftForm suggested={suggested} />
            </div>
          )}

          {/* Close shift — only the on-duty cashier or supervisor */}
          {active && activeDetail && (isOnDuty || isSupervisor) && (
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-stone-800">Close Shift</p>
              <p className="mb-3 text-xs text-stone-500">
                Enter the last AR number you issued. The next cashier will continue from the next number.
              </p>
              <CloseShiftForm sessionId={active.id} />
              {isSupervisor && !isOnDuty && (
                <p className="mt-2 text-[11px] text-amber-700 font-medium">
                  ⚠ You are force-closing {active.cashierName}&apos;s shift as supervisor.
                </p>
              )}
            </div>
          )}

          {/* Log cancelled AR */}
          {active && (isOnDuty || isSupervisor) && (
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-stone-800">Log Cancelled AR</p>
              <p className="mb-3 text-xs text-stone-500">
                AR voided due to error or correction. A reason is required and appears in the shift report.
              </p>
              <CancelArForm sessionId={active.id} />
            </div>
          )}

          {/* Waiting — another cashier on duty and user is not supervisor */}
          {active && !isOnDuty && !isSupervisor && (
            <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
              <p>Hotel operations are handled by <strong>{active.cashierName}</strong>.</p>
              <p className="mt-1 text-xs text-stone-400">
                Wait for their shift to be closed before you can open yours.
              </p>
            </div>
          )}
        </div>

        {/* ── Right: current shift detail ───────────────────────────────────── */}
        {activeDetail && (
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Current Shift — AR Summary
            </p>

            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-stone-400">Beginning AR</span>
                <p className="font-semibold text-stone-800">{activeDetail.beginningArNo}</p>
              </div>
              <div>
                <span className="text-stone-400">Payments issued</span>
                <p className="font-semibold text-stone-800">{activeDetail.payments.length}</p>
              </div>
              <div>
                <span className="text-stone-400">Cancelled ARs</span>
                <p className={`font-semibold ${activeDetail.cancellations.length > 0 ? "text-rose-700" : "text-stone-800"}`}>
                  {activeDetail.cancellations.length}
                </p>
              </div>
              <div>
                <span className="text-stone-400">Total collected</span>
                <p className="font-semibold text-stone-800">
                  ₱{activeDetail.payments.reduce((s, p) => s + p.amount, 0).toLocaleString("en-PH")}
                </p>
              </div>
            </div>

            {/* Payments list */}
            {activeDetail.payments.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-semibold uppercase text-stone-400">ARs Issued</p>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {activeDetail.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded bg-stone-50 px-2.5 py-1.5 text-xs">
                      <span className="font-mono font-semibold text-stone-700">{p.arNo ?? "—"}</span>
                      <span className="text-stone-500">{p.method}</span>
                      <span className="font-semibold">₱{p.amount.toLocaleString("en-PH")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancellations */}
            {activeDetail.cancellations.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase text-rose-500">Cancelled ARs</p>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {activeDetail.cancellations.map((c) => (
                    <div key={c.id} className="rounded border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="font-mono font-semibold text-rose-700">{c.arNo}</span>
                        <span className="text-stone-400">{fmt(c.cancelledAt)}</span>
                      </div>
                      <p className="mt-0.5 text-stone-600">{c.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Shift history ─────────────────────────────────────────────────────── */}
      {history.filter((s) => s.closedAt).length > 0 && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Shift History</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-100 text-left text-stone-400">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Cashier</th>
                  <th className="pb-2 pr-4 font-medium">Beginning AR</th>
                  <th className="pb-2 pr-4 font-medium">Ending AR</th>
                  <th className="pb-2 pr-4 font-medium">Opened</th>
                  <th className="pb-2 font-medium">Closed</th>
                </tr>
              </thead>
              <tbody>
                {history.filter((s) => s.closedAt).map((s) => (
                  <tr key={s.id} className="border-b border-stone-50">
                    <td className="py-2 pr-4 text-stone-500">{fmtDate(s.openedAt)}</td>
                    <td className="py-2 pr-4 font-medium text-stone-800">{s.cashierName}</td>
                    <td className="py-2 pr-4 font-mono text-stone-600">{s.beginningArNo}</td>
                    <td className="py-2 pr-4 font-mono text-stone-600">{s.endingArNo ?? "—"}</td>
                    <td className="py-2 pr-4 text-stone-500">{fmt(s.openedAt)}</td>
                    <td className="py-2 text-stone-500">{s.closedAt ? fmt(s.closedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
