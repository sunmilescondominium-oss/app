import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CRITICAL_COVERAGE } from "@/lib/config";

export interface CoverageGap { role_key: string; label: string; have: number; min: number }
export interface CoverageDay { date: string; gaps: CoverageGap[] }

/** Per-day critical-role coverage across the week (flags unattended tasks). */
export async function weekCoverage(weekStart: string): Promise<CoverageDay[]> {
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(new Date(`${weekStart}T00:00:00+08:00`).getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
  const admin = createAdminClient();
  const { data: sched } = await admin
    .from("shift_schedules")
    .select("user_id, work_date")
    .gte("work_date", days[0])
    .lte("work_date", days[6]);

  const ids = [...new Set((sched ?? []).map((r) => r.user_id as string))];
  const rolesByUser = new Map<string, Set<string>>();
  if (ids.length) {
    const { data: ur } = await admin.from("user_roles").select("user_id, role_key").in("user_id", ids);
    for (const r of ur ?? []) {
      const uid = r.user_id as string;
      (rolesByUser.get(uid) ?? rolesByUser.set(uid, new Set()).get(uid)!).add(r.role_key as string);
    }
  }

  const scheduledByDay = new Map<string, string[]>();
  for (const r of sched ?? []) {
    const d = r.work_date as string;
    (scheduledByDay.get(d) ?? scheduledByDay.set(d, []).get(d)!).push(r.user_id as string);
  }

  return days.map((date) => {
    const users = scheduledByDay.get(date) ?? [];
    const gaps: CoverageGap[] = [];
    for (const req of CRITICAL_COVERAGE) {
      const have = users.filter((u) => rolesByUser.get(u)?.has(req.role_key)).length;
      if (have < req.min) gaps.push({ role_key: req.role_key, label: req.label, have, min: req.min });
    }
    return { date, gaps };
  });
}

export interface ShiftRow {
  id: string;
  userId: string;
  label: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

/** Shifts scheduled on a given date, with staff labels. */
export async function scheduleForDate(date: string): Promise<ShiftRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("shift_schedules")
    .select("id, user_id, start_time, end_time, note")
    .eq("work_date", date)
    .order("start_time", { ascending: true, nullsFirst: true });
  const rows = data ?? [];

  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  const label = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, display_label").in("id", ids);
    for (const p of profs ?? []) label.set(p.id as string, (p.display_label as string) || "Staff");
  }
  return rows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    label: label.get(r.user_id as string) ?? "Staff",
    startTime: (r.start_time as string | null) ?? null,
    endTime: (r.end_time as string | null) ?? null,
    note: (r.note as string | null) ?? null,
  }));
}

export interface WeekCell {
  id: string;
  start: string | null;
  end: string | null;
  note: string | null;
}

/** 7-day shift grid starting at `weekStart`; cells keyed `${userId}|${date}`. */
export async function weekSchedule(weekStart: string): Promise<{ days: string[]; cells: Record<string, WeekCell> }> {
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(new Date(`${weekStart}T00:00:00+08:00`).getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
  const admin = createAdminClient();
  const { data } = await admin
    .from("shift_schedules")
    .select("id, user_id, work_date, start_time, end_time, note")
    .gte("work_date", days[0])
    .lte("work_date", days[6]);

  const cells: Record<string, WeekCell> = {};
  for (const r of data ?? []) {
    cells[`${r.user_id}|${r.work_date}`] = {
      id: r.id as string,
      start: (r.start_time as string | null) ?? null,
      end: (r.end_time as string | null) ?? null,
      note: (r.note as string | null) ?? null,
    };
  }
  return { days, cells };
}

/** Active staff (hold a role) for the assignment dropdown. */
export async function schedulableStaff(): Promise<{ id: string; label: string }[]> {
  const admin = createAdminClient();
  const [{ data: profs }, { data: roleRows }] = await Promise.all([
    admin.from("profiles").select("id, display_label, is_active"),
    admin.from("user_roles").select("user_id"),
  ]);
  const staff = new Set((roleRows ?? []).map((r) => r.user_id as string));
  return (profs ?? [])
    .filter((p) => p.is_active && staff.has(p.id as string))
    .map((p) => ({ id: p.id as string, label: (p.display_label as string) || "Staff" }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
