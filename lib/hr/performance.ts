import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { payrollReport } from "@/lib/hr/queries";

/**
 * Staff performance = attendance (worked days, punctuality, OT — doubles as the
 * DTR summary) + activity volume logged in the audit trail. Activity is counted
 * from audit_log.actor_user_id, the one per-user signal we keep alongside the
 * role-based records. SERVICE ROLE; gated at the page by requireModule("hr").
 */

export interface StaffPerformanceRow {
  userId: string;
  label: string;
  roles: string[];
  daysPresent: number;
  halfDays: number;
  lateDays: number;
  otHours: number;
  activity: number;
}

function endExclusive(to: string): string {
  const d = new Date(to + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function activityCounts(from: string, to: string): Promise<Map<string, number>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_log")
    .select("actor_user_id")
    .gte("created_at", from)
    .lt("created_at", endExclusive(to))
    .not("actor_user_id", "is", null);
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const uid = r.actor_user_id as string;
    map.set(uid, (map.get(uid) ?? 0) + 1);
  }
  return map;
}

async function roleMap(): Promise<Map<string, string[]>> {
  const admin = createAdminClient();
  const [{ data: ur }, { data: roles }] = await Promise.all([
    admin.from("user_roles").select("user_id, role_key"),
    admin.from("roles").select("role_key, label"),
  ]);
  const label = new Map((roles ?? []).map((r) => [r.role_key as string, r.label as string]));
  const map = new Map<string, string[]>();
  for (const r of ur ?? []) {
    const uid = r.user_id as string;
    const arr = map.get(uid) ?? [];
    arr.push(label.get(r.role_key as string) ?? (r.role_key as string));
    map.set(uid, arr);
  }
  return map;
}

export async function staffPerformance(from: string, to: string): Promise<StaffPerformanceRow[]> {
  const [payroll, activity, roles] = await Promise.all([
    payrollReport(from, to),
    activityCounts(from, to),
    roleMap(),
  ]);

  // Union of everyone who worked and everyone who logged activity.
  const ids = new Set<string>([...payroll.rows.map((r) => r.userId), ...activity.keys()]);
  const byId = new Map(payroll.rows.map((r) => [r.userId, r]));

  const rows: StaffPerformanceRow[] = [...ids].map((uid) => {
    const p = byId.get(uid);
    return {
      userId: uid,
      label: p?.label ?? "Staff",
      roles: roles.get(uid) ?? [],
      daysPresent: p?.daysPresent ?? 0,
      halfDays: p?.halfDays ?? 0,
      lateDays: p?.lateDays ?? 0,
      otHours: p?.otHours ?? 0,
      activity: activity.get(uid) ?? 0,
    };
  });

  return rows.sort((a, b) => b.daysPresent - a.daysPresent || b.activity - a.activity || a.label.localeCompare(b.label));
}

/** Per-user activity breakdown by entity (for the DTR/performance detail). */
export async function staffActivityBreakdown(userId: string, from: string, to: string): Promise<{ entity: string; count: number }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_log")
    .select("entity")
    .eq("actor_user_id", userId)
    .gte("created_at", from)
    .lt("created_at", endExclusive(to));
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const e = (r.entity as string) ?? "other";
    map.set(e, (map.get(e) ?? 0) + 1);
  }
  return [...map.entries()].map(([entity, count]) => ({ entity, count })).sort((a, b) => b.count - a.count);
}
