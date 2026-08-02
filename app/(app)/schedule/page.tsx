import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { scheduleForDate, schedulableStaff, weekSchedule } from "@/lib/scheduling/queries";
import { todayManila } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";
import { AssignForm, RemoveShift } from "@/components/scheduling/schedule-form";
import { WeekGrid } from "@/components/scheduling/week-grid";

export const metadata = { title: "Shift Schedule" };

function shiftDay(date: string, delta: number): string {
  return new Date(new Date(`${date}T00:00:00+08:00`).getTime() + delta * 86_400_000).toISOString().slice(0, 10);
}

/** Monday of the week containing `date` (Manila). */
function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00+08:00`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return shiftDay(date, -dow);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule("scheduling");
  const sp = await searchParams;
  const date = (typeof sp.date === "string" && sp.date) || todayManila();

  const weekStart = weekStartOf(date);
  const [shifts, staff, week] = await Promise.all([
    scheduleForDate(date),
    schedulableStaff(),
    weekSchedule(weekStart),
  ]);

  return (
    <>
      <PageHeader title="Shift Schedule" subtitle="Assign who works each day — drives absence detection & leave coverage." />

      <div className="mb-4 mt-4 flex items-center gap-3">
        <Link href={`/schedule?date=${shiftDay(date, -1)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">← Prev</Link>
        <form method="get" className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900">Go</button>
        </form>
        <Link href={`/schedule?date=${shiftDay(date, 1)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Next →</Link>
      </div>

      <div className="mb-4">
        <AssignForm staff={staff} date={date} />
      </div>

      {/* Weekly overview */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Week of {weekStart}</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-slate-400">click a cell to assign / remove</span>
            <Link href={`/schedule?date=${shiftDay(weekStart, -7)}`} className="rounded-lg border border-slate-300 px-2.5 py-1 hover:bg-slate-50">← Week</Link>
            <Link href={`/schedule?date=${shiftDay(weekStart, 7)}`} className="rounded-lg border border-slate-300 px-2.5 py-1 hover:bg-slate-50">Week →</Link>
          </div>
        </div>
        <WeekGrid staff={staff} days={week.days} cells={week.cells} today={date} />
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Shifts on {date}</h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3 text-right">·</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No shifts assigned for this day.</td></tr>
            )}
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-800">{s.label}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-600">
                  {s.startTime ? `${s.startTime.slice(0, 5)}–${s.endTime?.slice(0, 5) ?? "?"}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{s.note ?? "—"}</td>
                <td className="px-4 py-2.5 text-right"><RemoveShift id={s.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
