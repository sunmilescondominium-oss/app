"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { MODULE_LIST } from "@/lib/rbac/modules";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Save the full per-module read/write map for one role (admin / MO only). */
export async function setRolePermissions(
  roleKey: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("users");
  if (!userHasAnyRole(user, ["admin", "managing_officer"]))
    return { ok: false, error: "Only admin / managing officer can change access." };
  if (!roleKey) return { ok: false, error: "No role selected." };

  const actorRole = user.roleKeys.includes("admin") ? "admin" : "managing_officer";
  const rows = MODULE_LIST.map((m) => {
    const write = formData.get(`write:${m.key}`) != null;
    const read = write || formData.get(`read:${m.key}`) != null; // write implies read
    return { role_key: roleKey, module_key: m.key, can_read: read, can_write: write, updated_by_role: actorRole };
  });

  const admin = createAdminClient();
  const { error } = await admin.from("role_permissions").upsert(rows, { onConflict: "role_key,module_key" });
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "role_permissions", entityId: roleKey, diff: { modules: rows.filter((r) => r.can_read || r.can_write).map((r) => r.module_key) } });
  revalidatePath("/users/access");
  return { ok: true };
}

/** Reset a role to code defaults by removing all its override rows. */
export async function resetRolePermissions(roleKey: string): Promise<ActionResult> {
  const user = await requireModuleWrite("users");
  if (!userHasAnyRole(user, ["admin", "managing_officer"]))
    return { ok: false, error: "Only admin / managing officer can change access." };
  const admin = createAdminClient();
  const { error } = await admin.from("role_permissions").delete().eq("role_key", roleKey);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "role_permissions", entityId: roleKey, diff: { reset: true } });
  revalidatePath("/users/access");
  return { ok: true };
}
