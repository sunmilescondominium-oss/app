import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmployeeRow, LeaveRequest } from "./types";

/**
 * SERVICE-ROLE queries for the Employees roster & leave approvals. Only call
 * from a route gated by requireModule("employees").
 */

export async function employeeList(): Promise<EmployeeRow[]> {
  const admin = createAdminClient();
  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);

  const ids = list.users.map((u) => u.id);
  const guard = ids.length ? ids : ["__none__"];
  const [{ data: profiles }, { data: roleRows }, { data: pay }] = await Promise.all([
    admin.from("profiles").select("id, display_label, photo_path, is_active, employee_no, passcode_hash, qr_token").in("id", guard),
    admin.from("user_roles").select("user_id, role_key").in("user_id", guard),
    admin.from("staff_pay").select("user_id, daily_rate").in("user_id", guard),
  ]);

  const prof = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const rate = new Map((pay ?? []).map((p) => [p.user_id as string, Number(p.daily_rate) || 0]));
  const roles = new Map<string, string[]>();
  for (const r of (roleRows ?? []) as { user_id: string; role_key: string }[]) {
    const a = roles.get(r.user_id) ?? [];
    a.push(r.role_key);
    roles.set(r.user_id, a);
  }

  return list.users
    .map((u) => {
      const p = prof.get(u.id) as
        | { display_label?: string; photo_path?: string | null; is_active?: boolean; employee_no?: string | null; passcode_hash?: string | null; qr_token?: string | null }
        | undefined;
      return {
        id: u.id,
        label: p?.display_label ?? "—",
        email: u.email ?? null,
        roleKeys: roles.get(u.id) ?? [],
        photoPath: p?.photo_path ?? null,
        active: p?.is_active ?? true,
        dailyRate: rate.get(u.id) ?? 0,
        employeeNo: p?.employee_no ?? null,
        hasPasscode: Boolean(p?.passcode_hash),
        hasQr: Boolean(p?.qr_token),
      };
    })
    // Staff first (those holding any role), then by label.
    .sort((a, b) => Number(b.roleKeys.length > 0) - Number(a.roleKeys.length > 0) || a.label.localeCompare(b.label));
}

/** Leave requests (optionally filtered by status) with staff labels attached. */
export async function listLeave(status?: string): Promise<LeaveRequest[]> {
  const admin = createAdminClient();
  let q = admin
    .from("leave_requests")
    .select("id, user_id, leave_type, start_date, end_date, days, reason, status, decided_at, decision_note")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as LeaveRequest[];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length) {
    const { data: profiles } = await admin.from("profiles").select("id, display_label").in("id", ids);
    const label = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_label as string) || "Staff"]));
    for (const r of rows) r.label = label.get(r.user_id) ?? "Staff";
  }
  return rows;
}
