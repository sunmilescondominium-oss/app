import { requireModule } from "@/lib/auth/dal";
import Link from "next/link";
import { myPhotoPath, myLeave, myPayslip } from "@/lib/employee/queries";
import { myRecentRecords } from "@/lib/attendance/queries";
import { todayManila, peso } from "@/lib/collections/summary";
import { LEAVE_STATUSES } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { Avatar } from "@/components/employees/avatar";
import { LeaveForm, ObForm, RequestForm, CancelLeave } from "@/components/me/leave-form";

export const metadata = { title: "My Portal" };

const roleLabel = (k: string) => k.replace(/_/g, " ");
const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-stone-100 text-stone-500",
};

function t(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

export default async function MyPortalPage() {
  const user = await requireModule("employee");
  const [photoPath, records, leave] = await Promise.all([
    myPhotoPath(user.userId),
    myRecentRecords(user.userId, 8),
    myLeave(user.userId),
  ]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthHours = records
    .filter((r) => r.work_date.startsWith(thisMonth) && r.hours != null)
    .reduce((s, r) => s + (r.hours ?? 0), 0);

  const payslip = await myPayslip(user.userId, `${thisMonth}-01`, todayManila());

  return (
    <>
      <PageHeader
        backHref="/dashboard" title="My Portal" subtitle="Your attendance, leave, and staff details." />

      {/* Profile */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5">
        <Avatar id={user.userId} label={user.displayLabel} photoPath={photoPath} size={64} />
        <div>
          <p className="text-lg font-semibold text-stone-800">{user.displayLabel}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {user.allRoleKeys.map((r) => (
              <span key={r} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] capitalize text-stone-600">
                {roleLabel(r)}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-stone-400">A photo can be added by HR/admin from the Employees page.</p>
        </div>
      </div>

      {/* Payslip (this month) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-5">
        <div>
          <p className="text-sm text-stone-500">My pay this month (est.)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{peso(payslip.net)}</p>
          <p className="mt-0.5 text-xs text-stone-400">Basic {peso(payslip.basic)} · OT {peso(payslip.ot)} · Deductions ({peso(payslip.deductions)})</p>
        </div>
        <Link href="/me/payslip" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
          View / print payslip →
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Attendance */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">My attendance</h2>
            <span className="text-xs text-stone-400">Clock in / out at the attendance kiosk</span>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="mb-3 text-sm text-stone-600">
              This month: <span className="font-semibold tabular-nums text-stone-800">{monthHours.toFixed(2)} h</span>
            </p>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="py-1">Date</th>
                  <th className="py-1">In</th>
                  <th className="py-1">Out</th>
                  <th className="py-1 text-right">Hrs</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-stone-400">No records yet.</td></tr>
                )}
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-stone-100">
                    <td className="py-1.5">{r.work_date}</td>
                    <td className="py-1.5">{t(r.time_in)}</td>
                    <td className="py-1.5">{r.time_out ? t(r.time_out) : <span className="text-emerald-600">open</span>}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.hours != null ? r.hours.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Leave */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Requests</h2>
          <div className="space-y-2">
            <LeaveForm />
            <ObForm />
            <RequestForm />
          </div>
          <div className="mt-3 rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Dates</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {leave.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No leave requests yet.</td></tr>
                )}
                {leave.map((l) => (
                  <tr key={l.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5">{l.leave_type}</td>
                    <td className="px-4 py-2.5 text-stone-500">
                      {l.hours != null ? `${l.start_date} · ${l.hours}h` : `${l.start_date} → ${l.end_date} (${l.days}d)`}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[l.status] ?? "bg-stone-100 text-stone-500"}`}>
                        {LEAVE_STATUSES.find((s) => s.key === l.status)?.label ?? l.status}
                      </span>
                      {l.decision_note && <span className="ml-1 text-[11px] text-stone-400">· {l.decision_note}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{l.status === "pending" && <CancelLeave id={l.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
