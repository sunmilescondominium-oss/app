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
