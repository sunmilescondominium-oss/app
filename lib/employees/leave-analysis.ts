import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAFF_ROLE_KEYS } from "@/lib/rbac/modules";
import { LEAVE_MIN_LEAD_DAYS } from "@/lib/config";
import { todayManila } from "@/lib/collections/summary";

export interface LeaveConflict {
  leadDays: number;
  leadOk: boolean;
  /** Roles the requester holds where NO other active staff exist at all. */
  soleRoles: { role: string; label: string }[];
  /** Roles where others exist but NONE are scheduled during the leave window. */
  uncoveredRoles: { role: string; label: string }[];
  /** Coverage per role: other holders + how many are scheduled in the window. */
  coverage: { role: string; label: string; others: number; scheduled: number }[];
  openRepairs: number;
  openHousekeeping: number;
  /** True when no shifts exist in the window to judge coverage against. */
  noScheduleData: boolean;
  /** True when anything needs the approver's attention. */
  hasConcern: boolean;
}

const roleLabel = (key: string) => key.replace(/_/g, " ");

/**
 * Flags whether a leave request would leave work uncovered — role coverage,
 * open tasks assigned to the requester's roles, and lead time. SERVICE ROLE;
 * call only from an approver-gated context.
 */
export async function analyzeLeave(input: {
  userId: string;
  start_date: string;
  end_date?: string;
}): Promise<LeaveConflict> {
  const admin = createAdminClient();
  const endDate = input.end_date || input.start_date;

  const leadDays = Math.round((new Date(input.start_date).getTime() - new Date(todayManila()).getTime()) / 86_400_000);
  const leadOk = leadDays >= LEAVE_MIN_LEAD_DAYS;

  const { data: myRoleRows } = await admin.from("user_roles").select("role_key").eq("user_id", input.userId);
  const roleKeys = (myRoleRows ?? [])
    .map((r) => r.role_key as string)
    .filter((r) => (STAFF_ROLE_KEYS as string[]).includes(r));

  const empty = {
    leadDays,
    leadOk,
    soleRoles: [],
    uncoveredRoles: [],
    coverage: [],
    openRepairs: 0,
    openHousekeeping: 0,
    noScheduleData: false,
  };
  if (roleKeys.length === 0) return { ...empty, hasConcern: !leadOk };

  const [{ data: sharers }, { data: profs }, { data: shifts }, repairs, housekeeping] = await Promise.all([
    admin.from("user_roles").select("user_id, role_key").in("role_key", roleKeys),
    admin.from("profiles").select("id, is_active"),
    admin.from("shift_schedules").select("user_id").gte("work_date", input.start_date).lte("work_date", endDate),
    admin.from("repair_requests").select("id", { count: "exact", head: true }).in("assigned_to_role", roleKeys).neq("status", "completed"),
    admin.from("housekeeping_tasks").select("id", { count: "exact", head: true }).in("assigned_to_role", roleKeys).neq("status", "done"),
  ]);

  const active = new Set((profs ?? []).filter((p) => p.is_active).map((p) => p.id as string));
  const scheduledInWindow = new Set((shifts ?? []).map((s) => s.user_id as string));
  const noScheduleData = (shifts ?? []).length === 0;

  const coverage = roleKeys.map((role) => {
    const otherHolders = new Set(
      (sharers ?? [])
        .filter((s) => s.role_key === role && s.user_id !== input.userId && active.has(s.user_id as string))
        .map((s) => s.user_id as string),
    );
    const scheduled = [...otherHolders].filter((id) => scheduledInWindow.has(id)).length;
    return { role, label: roleLabel(role), others: otherHolders.size, scheduled };
  });

  const soleRoles = coverage.filter((c) => c.others === 0).map((c) => ({ role: c.role, label: c.label }));
  const uncoveredRoles = coverage
    .filter((c) => c.others > 0 && c.scheduled === 0 && !noScheduleData)
    .map((c) => ({ role: c.role, label: c.label }));
  const openRepairs = repairs.count ?? 0;
  const openHousekeeping = housekeeping.count ?? 0;

  return {
    leadDays,
    leadOk,
    soleRoles,
    uncoveredRoles,
    coverage,
    openRepairs,
    openHousekeeping,
    noScheduleData,
    hasConcern: !leadOk || soleRoles.length > 0 || uncoveredRoles.length > 0 || openRepairs > 0 || openHousekeeping > 0,
  };
}
