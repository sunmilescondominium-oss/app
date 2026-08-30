import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";
import { EXTERNAL_ROLE_KEYS } from "@/lib/rbac/modules";
import { APP_DEMO_DOMAIN } from "@/lib/config";

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

  // Role display order for the board (lower = shown first, e.g. owner/CEO → 1).
  const { data: roleDefs } = await admin.from("roles").select("role_key, sort_order");
  const roleOrder = new Map((roleDefs ?? []).map((r) => [r.role_key as string, Number(r.sort_order ?? 100)]));

  // Demo accounts (seeded @demo.sunmiles.local) are always sorted to the bottom.
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const demoIds = new Set((authList?.users ?? []).filter((u) => (u.email ?? "").endsWith(`@${APP_DEMO_DOMAIN}`)).map((u) => u.id));

  // Employees only — a user counts as staff if they hold at least one non-external
  // role. Tenants/buyers/guests (external roles) are excluded from the kiosk.
  const staffIds = new Set(
    (roleRows ?? [])
      .filter((r) => !(EXTERNAL_ROLE_KEYS as readonly string[]).includes(r.role_key as string))
      .map((r) => r.user_id as string),
  );

  // Each employee's board rank = the best (lowest sort_order) role they hold.
  const rankByUser = new Map<string, number>();
  for (const r of roleRows ?? []) {
    const key = r.role_key as string;
    if ((EXTERNAL_ROLE_KEYS as readonly string[]).includes(key)) continue;
    const uid = r.user_id as string;
    const rank = roleOrder.get(key) ?? 100;
    rankByUser.set(uid, Math.min(rankByUser.get(uid) ?? Infinity, rank));
  }

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
    .sort((a, b) => {
      const da = demoIds.has(a.id) ? 1 : 0;
      const db = demoIds.has(b.id) ? 1 : 0;
      if (da !== db) return da - db; // demo accounts last
      return (rankByUser.get(a.id) ?? 999) - (rankByUser.get(b.id) ?? 999) || a.label.localeCompare(b.label);
    });

  return { date, items };
}
