"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HousekeepingTask, OccupiedRoom } from "@/lib/housekeeping/types";
import { t, type Lang } from "@/lib/i18n";
import { HKAlarm } from "@/components/housekeeping/hk-alarm";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-emerald-100 text-emerald-800",
};
const STATUS_KEY: Record<string, string> = { pending: "hk_st_pending", in_progress: "hk_st_in_progress", done: "hk_st_done" };

/** "2h 05m" / "12m" / "now". Signed handled by caller. */
function fmtDur(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return "now";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}

export function AttendantBoard({
  tasks,
  occupied,
  shiftEndIso,
  lang = "en",
}: {
  tasks: HousekeepingTask[];
  occupied: OccupiedRoom[];
  shiftEndIso: string | null;
  lang?: Lang;
}) {
  const tr = (k: string) => t(lang, k);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const shiftEnd = shiftEndIso ? new Date(shiftEndIso).getTime() : null;
  const open = tasks.filter((t) => t.status !== "done");

  // A pending task whose clean can't finish before shift end is "for next team".
  const forNextTeam = (task: HousekeepingTask) => {
    if (task.status !== "pending" || !shiftEnd) return false;
    const mins = task.cleaning_minutes && task.cleaning_minutes > 0 ? task.cleaning_minutes : 45;
    return now + mins * 60000 > shiftEnd;
  };

  return (
    <div>
      <HKAlarm tasks={open} />
    <div className="space-y-6">
      {/* Occupancy watch */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{tr("hk_occupancy")}</h2>
        <p className="mb-2 text-xs text-stone-400">{tr("hk_occupancy_hint")}</p>
        {occupied.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">{tr("hk_no_guests")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {occupied.map((r) => {
              const elapsed = now - new Date(r.check_in_at).getTime();
              const out = r.expected_out_at ? new Date(r.expected_out_at).getTime() : null;
              const overdue = out != null && now > out;
              const afterShift = out != null && shiftEnd != null && out > shiftEnd;
              return (
                <div key={`${r.source}-${r.ref_id}`} className={`rounded-xl border p-3 ${overdue ? "border-rose-300 bg-rose-50" : "border-stone-200 bg-white"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-900">{r.unit_number ?? "—"}</span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-500">{r.source}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">{r.guest_label}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-stone-600">{tr("hk_in_room")}: <span className="font-medium tabular-nums">{fmtDur(elapsed)}</span></span>
                    {out != null && (
                      overdue
                        ? <span className="font-semibold text-rose-700">{tr("hk_checkout_overdue")}</span>
                        : <span className="text-stone-600">{tr("hk_checkout_in")}: <span className="font-medium tabular-nums">{fmtDur(out - now)}</span></span>
                    )}
                  </div>
                  {afterShift && <p className="mt-1 text-[11px] font-medium text-indigo-700">{tr("hk_after_shift")}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Cleaning tasks */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{tr("hk_tasks")}</h2>
        <div className="table-wrap">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">{tr("hk_room")}</th>
                <th className="px-4 py-3">{tr("col_status")}</th>
                <th className="px-4 py-3">{tr("hk_timer")}</th>
                <th className="px-4 py-3">{tr("hk_assigned")}</th>
              </tr>
            </thead>
            <tbody>
              {open.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-stone-500">{tr("hk_no_tasks")}</td></tr>
              )}
              {open.map((task) => {
                const startBy = task.start_by ? new Date(task.start_by).getTime() : null;
                const lateToStart = task.status === "pending" && startBy != null && now > startBy;
                const nextTeam = forNextTeam(task);
                const cleanEnds = task.status === "in_progress" && task.started_at && task.cleaning_minutes
                  ? new Date(task.started_at).getTime() + task.cleaning_minutes * 60000
                  : null;
                const cleanOverdue = cleanEnds != null && now > cleanEnds;
                return (
                  <tr key={task.id} className={`border-b border-stone-100 last:border-0 ${lateToStart || cleanOverdue ? "bg-rose-50" : ""}`}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/housekeeping/${task.id}`} className="text-amber-700 hover:underline">{task.unit_number ?? "—"}</Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {task.endorsed && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{tr("hk_badge_endorsed")}</span>}
                        {task.escalated && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{tr("hk_badge_escalated")}</span>}
                        {nextTeam && !task.endorsed && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">{tr("hk_badge_next_team")}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[task.status] ?? ""}`}>{tr(STATUS_KEY[task.status] ?? "")}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {task.status === "pending" && startBy != null && (
                        lateToStart
                          ? <span className="font-semibold text-rose-700">{tr("hk_start_overdue")}</span>
                          : <span className="text-stone-600">{tr("hk_start_within")}: <span className="font-medium tabular-nums">{fmtDur(startBy - now)}</span></span>
                      )}
                      {task.status === "in_progress" && cleanEnds != null && (
                        cleanOverdue
                          ? <span className="font-semibold text-rose-700">{tr("hk_clean_overdue")}</span>
                          : <span className="text-stone-600">{tr("hk_time_left")}: <span className="font-medium tabular-nums">{fmtDur(cleanEnds - now)}</span></span>
                      )}
                      {task.status === "pending" && startBy == null && <span className="text-stone-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">{task.assigned_to_role ? task.assigned_to_role.replace(/_/g, " ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </div>
  );
}
