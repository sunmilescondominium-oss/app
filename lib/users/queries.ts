import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ManagedUser, RoleOption } from "./types";

/**
 * These queries use the SERVICE-ROLE admin client (to list all auth users +
 * emails and read every profile/role). They must ONLY be called from a route
 * gated by requireModule("users") — the auth boundary is the page, not here.
 */

export async function listRoles(): Promise<RoleOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("roles")
    .select("role_key, label, is_staff, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RoleOption[];
}

export async function listUsersWithRoles(): Promise<ManagedUser[]> {
  const admin = createAdminClient();

  const { data: list, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw new Error(error.message);

  const users = list.users;
  const ids = users.map((u) => u.id);
  const guard = ids.length ? ids : ["__none__"];

  const [{ data: profiles }, { data: roleRows }, { data: roleMeta }] = await Promise.all([
    admin.from("profiles").select("id, display_label, is_active, email_verified_at, invite_sent_at").in("id", guard),
    admin.from("user_roles").select("user_id, role_key").in("user_id", guard),
    admin.from("roles").select("role_key, sort_order"),
  ]);

  const profMap = new Map(
    (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
  );
  const rolesByUser = new Map<string, string[]>();
  for (const r of (roleRows ?? []) as { user_id: string; role_key: string }[]) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role_key);
    rolesByUser.set(r.user_id, arr);
  }
  // Role display order (same order used on the attendance board / kiosk).
  const roleOrder = new Map<string, number>();
  for (const r of (roleMeta ?? []) as { role_key: string; sort_order: number }[]) {
    roleOrder.set(r.role_key, Number(r.sort_order));
  }
  const primaryOrder = (keys: string[]) =>
    keys.length ? Math.min(...keys.map((k) => roleOrder.get(k) ?? 9999)) : 9999;

  return users
    .map((u) => {
      const p = profMap.get(u.id) as
        | { display_label?: string; is_active?: boolean; email_verified_at?: string | null; invite_sent_at?: string | null }
        | undefined;
      const roleKeys = rolesByUser.get(u.id) ?? [];
      return {
        id: u.id,
        email: u.email ?? null,
        displayLabel: p?.display_label ?? "—",
        isActive: p?.is_active ?? true,
        roleKeys,
        emailVerifiedAt: p?.email_verified_at ?? null,
        inviteSentAt: p?.invite_sent_at ?? null,
        _order: primaryOrder(roleKeys),
      };
    })
    // Group by role order (attendance sort), then name, then email.
    .sort((a, b) => a._order - b._order || a.displayLabel.localeCompare(b.displayLabel) || (a.email ?? "").localeCompare(b.email ?? ""))
    .map(({ _order, ...u }) => { void _order; return u; });
}
