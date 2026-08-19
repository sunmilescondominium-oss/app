import Link from "next/link";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import {
  getActiveSession,
  getAllOpenSessions,
  getSessionHistory,
  getSessionSummary,
  getSuggestedNextArNo,
  listShiftReports,
} from "@/lib/hotel/session";
import { OpenShiftForm } from "./open-shift-form";
import { CloseShiftForm } from "./close-shift-form";
import { CancelArForm } from "./cancel-ar-form";
import { SupervisorPanel } from "./supervisor-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cashier Shifts" };

const SUPERVISOR = [
  "hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting",
] as const;

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  const [active, allOpen, suggested, history, reports] = await Promise.all([
    getActiveSession(),
    isSupervisor ? getAllOpenSessions() : Promise.resolve([]),
    getSuggestedNextArNo(),
    getSessionHistory(10),
    isSupervisor ? listShiftReports(10) : Promise.resolve([]),
  ]);

  const activeDetail = active ? await getSessionSummary(active.id) : null;
  const isOnDuty = active?.cashierUserId === user.userId;

  // Count active stays so the close-shift form can warn the cashier
  let activeStayCount = 0;
  if (active && (isOnDuty || isSupervisor)) {
    const admin = createAdminClient();
    const { count } = await admin.from("stays").select("id", { count: "exact", head: true }).eq("status", "active");
    activeStayCount = count ?? 0;
  }

  const pendingReports = reports.filter((r) => r.status === "pending");

  // Stuck sessions: open in DB but not picked up by getActiveSession() (e.g. multiple rows)
  const stuckSessions = allOpen.filter((s) => s.id !== active?.id);

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="Cashier Shifts"
        subtitle="Open and close your shift, declare AR numbers, and log cancellations."
      />

      {/* ── Pending report alert (supervisors) ──────────────────────────────── */}
      {isSupervisor && pendingReports.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">
            {pendingReports.length} shift report{pendingReports.length > 1 ? "s" : ""} pending acknowledgement
          </p>
          <div className="space-y-1">
            {pendingReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4">
                <p className="text-xs text-amber-800">
                  {r.cashierName} · {fmtDate(r.openedAt)} · AR {r.beginningArNo}→{r.endingArNo} · {peso(r.totalCollected)}
                </p>
                <Link
                  href={`/hotel/shifts/${r.sessionId}/report`}
                  className="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  View &amp; acknowledge
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <p className="mt-0.5 text-xs text-stone-400">
            Hotel check-in, check-out, and payments are locked until a cashier opens their shift.
          </p>
        </div>
      )}

      {/* ── Stuck / ghost sessions (supervisor only) ────────────────────────── */}
      {isSupervisor && stuckSessions.length > 0 && (
        <div className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-4">
          <p className="mb-1 text-sm font-semibold text-rose-900">
            ⚠ {stuckSessions.length} stuck session{stuckSessions.length > 1 ? "s" : ""} found
          </p>
          <p className="mb-3 text-xs text-rose-700">
            These sessions are open in the database but not displayed as the active shift. They are blocking new shifts from opening. Force-close them below.
          </p>
          <div className="space-y-2">
            {stuckSessions.map((s) => (
              <div key={s.id} className="rounded-lg border border-rose-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-semibold text-stone-800">{s.cashierName}</p>
                    <p className="text-stone-500">Opened {fmt(s.openedAt)} · Beginning AR: {s.beginningArNo}</p>
                  </div>
                  <SupervisorPanel sessionId={s.id} cashierName={s.cashierName} isOnDuty={false} compact />
                </div>
              </div>
            ))}
          </div>
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
              <p className="mb-1 text-sm font-semibold text-stone-800">End Shift</p>
              <p className="mb-3 text-xs text-stone-500">
                Enter the last AR number you issued. A shift report will be auto-generated and sent to Hotel &amp; Rental Monitoring for acknowledgement.
              </p>
              <CloseShiftForm sessionId={active.id} activeStayCount={activeStayCount} />
              {isSupervisor && !isOnDuty && (
                <p className="mt-2 text-[11px] font-medium text-amber-700">
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
                AR voided due to error or correction. A reason is required and will appear in the shift report.
              </p>
              <CancelArForm sessionId={active.id} />
            </div>
          )}

          {/* Supervisor override panel — void/cancel shift */}
          {active && isSupervisor && (
            <SupervisorPanel
              sessionId={active.id}
              cashierName={active.cashierName}
              isOnDuty={isOnDuty}
            />
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
                  {peso(activeDetail.payments.reduce((s, p) => s + p.amount, 0))}
                </p>
              </div>
            </div>

            {/* Payments list */}
            {activeDetail.payments.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-semibold uppercase text-stone-400">ARs Issued</p>
                <div className="max-h-44 space-y-1 overflow-y-auto">
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
                <div className="max-h-36 space-y-1 overflow-y-auto">
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

      {/* ── Shift history with report links ─────────────────────────────────── */}
      {history.filter((s) => s.closedAt).length > 0 && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Shift History</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-100 text-left text-stone-400">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Cashier</th>
                  <th className="pb-2 pr-4 font-medium">AR Range</th>
                  <th className="pb-2 pr-4 font-medium">Opened</th>
                  <th className="pb-2 pr-4 font-medium">Closed</th>
                  {isSupervisor && <th className="pb-2 font-medium">Report</th>}
                </tr>
              </thead>
              <tbody>
                {history.filter((s) => s.closedAt).map((s) => {
                  const rep = reports.find((r) => r.sessionId === s.id);
                  return (
                    <tr key={s.id} className="border-b border-stone-50">
                      <td className="py-2 pr-4 text-stone-500">{fmtDate(s.openedAt)}</td>
                      <td className="py-2 pr-4 font-medium text-stone-800">{s.cashierName}</td>
                      <td className="py-2 pr-4 font-mono text-stone-600">{s.beginningArNo} → {s.endingArNo ?? "—"}</td>
                      <td className="py-2 pr-4 text-stone-500">{fmt(s.openedAt)}</td>
                      <td className="py-2 pr-4 text-stone-500">{s.closedAt ? fmt(s.closedAt) : "—"}</td>
                      {isSupervisor && (
                        <td className="py-2">
                          <Link
                            href={`/hotel/shifts/${s.id}/report`}
                            className="text-amber-700 hover:underline"
                          >
                            {rep ? (rep.status === "acknowledged" ? "✓ Acknowledged" : "Pending ↗") : "View ↗"}
                          </Link>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
