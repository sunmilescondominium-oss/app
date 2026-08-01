import { requireModule } from "@/lib/auth/dal";
import { myOpenRecord, myRecentRecords } from "@/lib/attendance/queries";
import { PageHeader } from "@/components/ui";
import { AttendanceClock } from "@/components/attendance/attendance-clock";

export const metadata = { title: "Attendance" };

function t(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

export default async function AttendancePage() {
  const user = await requireModule("attendance");
  const [open, recent] = await Promise.all([myOpenRecord(user.userId), myRecentRecords(user.userId)]);

  return (
    <>
      <PageHeader title="Attendance" subtitle={`Signed in as ${user.displayLabel}`} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <AttendanceClock clockedIn={Boolean(open)} since={open?.time_in ?? null} />

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">My recent records</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">In</th>
                  <th className="px-4 py-3">Out</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3">Photos</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No records yet.</td>
                  </tr>
                )}
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5">{r.work_date}</td>
                    <td className="px-4 py-2.5">{t(r.time_in)}</td>
                    <td className="px-4 py-2.5">{r.time_out ? t(r.time_out) : <span className="text-emerald-600">open</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.hours != null ? r.hours.toFixed(2) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex gap-2 text-xs">
                        {r.time_in_photo && (
                          <a href={`/api/attendance/${r.id}/photo?kind=in`} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
                            in
                          </a>
                        )}
                        {r.time_out_photo && (
                          <a href={`/api/attendance/${r.id}/photo?kind=out`} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">
                            out
                          </a>
                        )}
                        {!r.time_in_photo && !r.time_out_photo && "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
