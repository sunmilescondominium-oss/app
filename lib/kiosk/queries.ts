import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";
import { EXTERNAL_ROLE_KEYS } from "@/lib/rbac/modules";

export type BoardStatus = "checked_in" | "checked_out" | "on_ob" | "on_leave" | "absent" | "off";

export interface BoardItem {
  id: string;
  label: string;
  photoPath: string | null;
  status: BoardStatus;
  timeIn: string | null;
  timeOut: string | null;
  scheduled: boolean;
  duration: string | null; // for OB/leave: whole_day | half_day
  dtrExempt: boolean; // fixed-salary staff who don't file a DTR
}

/**
 * Today's attendance board for the PUBLIC kiosk — every active staff member and
 * their current status. SERVICE ROLE (the kiosk has no PMS session).
 */
export async function todayBoard(): Promise<{ date: string; items: BoardItem[] }> {
  const admin = createAdminClient();
  const date = todayManila();

  const [{ data: profiles }, { data: records }, { data: leaves }, { data: shifts }, { data: roleRows }, { data: pay }] =
    await Promise.all([
      admin.from("profiles").select("id, display_label, full_name, photo_path, is_active"),
      admin.from("time_records").select("user_id, time_in, time_out").eq("work_date", date),
      admin
        .from("leave_requests")
        .select("user_id, category, duration")
        .eq("status", "approved")
        .lte("start_date", date)
        .gte("end_date", date),
      admin.from("shift_schedules").select("user_id").eq("work_date", date),
      admin.from("user_roles").select("user_id, role_key"),
      admin.from("staff_pay").select("user_id, dtr_exempt"),
    ]);

  const exempt = new Set((pay ?? []).filter((p) => p.dtr_exempt).map((p) => p.user_id as string));

  // Employees only — a user counts as staff if they hold at least one non-external
  // role. Tenants/buyers/guests (external roles) are excluded from the kiosk.
  const staffIds = new Set(
    (roleRows ?? [])
      .filter((r) => !(EXTERNAL_ROLE_KEYS as readonly string[]).includes(r.role_key as string))
      .map((r) => r.user_id as string),
  );

  const recByUser = new Map<string, { time_in: string | null; time_out: string | null }>();
  for (const r of records ?? []) recByUser.set(r.user_id as string, { time_in: r.time_in as string | null, time_out: r.time_out as string | null });

  const leaveByUser = new Map<string, { category: string; duration: string | null }>();
  for (const l of leaves ?? []) leaveByUser.set(l.user_id as string, { category: l.category as string, duration: l.duration as string | null });

  const scheduled = new Set((shifts ?? []).map((s) => s.user_id as string));

  const items: BoardItem[] = (profiles ?? [])
    .filter((p) => p.is_active && staffIds.has(p.id as string))
    .map((p) => {
      const id = p.id as string;
      const rec = recByUser.get(id);
      const lv = leaveByUser.get(id);
      let status: BoardStatus;
      if (rec) status = rec.time_out ? "checked_out" : "checked_in";
      else if (lv?.category === "ob") status = "on_ob";
      else if (lv?.category === "leave") status = "on_leave";
      else if (scheduled.has(id)) status = "absent";
      else status = "off";
      return {
        id,
        label: (p.full_name as string) || (p.display_label as string) || "Staff",
        photoPath: (p.photo_path as string | null) ?? null,
        status,
        timeIn: rec?.time_in ?? null,
        timeOut: rec?.time_out ?? null,
        scheduled: scheduled.has(id),
        duration: lv?.duration ?? null,
        dtrExempt: exempt.has(id),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return { date, items };
}
