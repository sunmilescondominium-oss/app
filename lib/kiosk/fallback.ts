import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXTERNAL_ROLE_KEYS } from "@/lib/rbac/modules";

/** Roles that may APPROVE a guard's kiosk-down request. */
export const FALLBACK_AUTHORIZER_ROLES = ["owner", "managing_officer", "consultant", "operations_manager", "admin"];
/** Roles that may REQUEST / operate (report + deactivate) a fallback. */
export const FALLBACK_OPERATOR_ROLES = ["guard", "owner", "managing_officer", "consultant", "operations_manager", "admin"];

export type OutageStatus = "pending" | "active" | "closed" | "expired" | "rejected";

export interface OutageGrant {
  userId: string;
  label: string;
  employeeNo: string | null;
  used: boolean;
  usedAt: string | null;
}

export interface Outage {
  id: string;
  code: string | null;
  status: OutageStatus;
  punchKind: "in" | "out";
  reason: string | null;
  requestedByLabel: string | null;
  approvedByLabel: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  rejectReason: string | null;
  closedAt: string | null;
  createdAt: string;
  grants: OutageGrant[];
  doneCount: number;
}

async function labelMap(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, string>> {
  const { data } = await admin.from("profiles").select("id, display_label, full_name");
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.display_label as string) || "Staff"]));
}

/** Recent outage instances (pending/active first) for the fallback console. */
export async function listOutages(limit = 30): Promise<Outage[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("kiosk_outages").select("*").order("created_at", { ascending: false }).limit(limit);
  if (!rows || rows.length === 0) return [];
  const ids = rows.map((r) => r.id as string);
  const [{ data: grants }, labels] = await Promise.all([
    admin.from("kiosk_outage_grants").select("*").in("outage_id", ids),
    labelMap(admin),
  ]);
  const byOutage = new Map<string, OutageGrant[]>();
  for (const g of grants ?? []) {
    const arr = byOutage.get(g.outage_id as string) ?? [];
    arr.push({
      userId: g.user_id as string,
      label: labels.get(g.user_id as string) ?? "Staff",
      employeeNo: (g.employee_no as string) ?? null,
      used: Boolean(g.used_at),
      usedAt: (g.used_at as string) ?? null,
    });
    byOutage.set(g.outage_id as string, arr);
  }
  return rows.map((r) => {
    const gs = (byOutage.get(r.id as string) ?? []).sort((a, b) => a.label.localeCompare(b.label));
    return {
      id: r.id as string,
      code: (r.code as string) ?? null,
      status: r.status as OutageStatus,
      punchKind: r.punch_kind as "in" | "out",
      reason: (r.reason as string) ?? null,
      requestedByLabel: r.requested_by ? labels.get(r.requested_by as string) ?? null : null,
      approvedByLabel: r.approved_by ? labels.get(r.approved_by as string) ?? null : null,
      approvedAt: (r.approved_at as string) ?? null,
      expiresAt: (r.expires_at as string) ?? null,
      rejectReason: (r.reject_reason as string) ?? null,
      closedAt: (r.closed_at as string) ?? null,
      createdAt: r.created_at as string,
      grants: gs,
      doneCount: gs.filter((g) => g.used).length,
    };
  });
}

/** True if the user holds at least one staff (non-external) role. */
export async function userIsStaff(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_roles").select("role_key").eq("user_id", userId);
  return (data ?? []).some((r) => !(EXTERNAL_ROLE_KEYS as readonly string[]).includes(r.role_key as string));
}
