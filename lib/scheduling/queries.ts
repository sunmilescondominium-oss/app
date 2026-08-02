import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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

export interface WeekRow {
  userId: string;
  label: string;
  byDate: Record<string, { start: string | null; end: string | null; note: string | null }>;
}

/** 7-day grid of shifts starting at `weekStart` (staff with any shift that week). */
export async function weekSchedule(weekStart: string): Promise<{ days: string[]; rows: WeekRow[] }> {
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(new Date(`${weekStart}T00:00:00+08:00`).getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
  const admin = createAdminClient();
  const { data } = await admin
    .from("shift_schedules")
    .select("user_id, work_date, start_time, end_time, note")
    .gte("work_date", days[0])
    .lte("work_date", days[6]);
  const rows = data ?? [];

  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  const label = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, display_label").in("id", ids);
    for (const p of profs ?? []) label.set(p.id as string, (p.display_label as string) || "Staff");
  }

  const byUser = new Map<string, WeekRow>();
  for (const r of rows) {
    const uid = r.user_id as string;
    const row = byUser.get(uid) ?? { userId: uid, label: label.get(uid) ?? "Staff", byDate: {} };
    row.byDate[r.work_date as string] = {
      start: (r.start_time as string | null) ?? null,
      end: (r.end_time as string | null) ?? null,
      note: (r.note as string | null) ?? null,
    };
    byUser.set(uid, row);
  }

  return { days, rows: [...byUser.values()].sort((a, b) => a.label.localeCompare(b.label)) };
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
