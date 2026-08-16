"use server";

import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";

const ALLOWED = ["admin", "managing_officer"] as const;

export interface ModuleRoleOverride {
  module_key: string;
  role_key: string;
  can_read: boolean;
  can_write: boolean;
}

/** Load all DB overrides for the permission matrix. */
export async function getModuleRoleOverrides(): Promise<ModuleRoleOverride[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("module_role_permissions")
    .select("module_key, role_key, can_read, can_write");
  return (data ?? []) as ModuleRoleOverride[];
}

/** Upsert a single role+module permission override. */
export async function setRolePermission(
  moduleKey: string,
  roleKey: string,
  canRead: boolean,
  canWrite: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...ALLOWED]))
    return { ok: false, error: "Only admin and managing officer can change role permissions." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("module_role_permissions")
    .upsert(
      { module_key: moduleKey, role_key: roleKey, can_read: canRead, can_write: canWrite, updated_by: user.userId, updated_at: new Date().toISOString() },
      { onConflict: "module_key,role_key" },
    );
  if (error) return { ok: false, error: error.message };

  revalidateTag("module-role-permissions");
  revalidatePath("/admin/role-permissions");
  return { ok: true };
}

/** Delete an override (revert to hardcoded default). */
export async function clearRolePermission(
  moduleKey: string,
  roleKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...ALLOWED]))
    return { ok: false, error: "Only admin and managing officer can change role permissions." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("module_role_permissions")
    .delete()
    .eq("module_key", moduleKey)
    .eq("role_key", roleKey);
  if (error) return { ok: false, error: error.message };

  revalidateTag("module-role-permissions");
  revalidatePath("/admin/role-permissions");
  return { ok: true };
}

/** Set permissions for all roles in a group for one module (group toggle). */
export async function setGroupPermission(
  moduleKey: string,
  groupRoles: string[],
  canRead: boolean,
  canWrite: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...ALLOWED]))
    return { ok: false, error: "Only admin and managing officer can change role permissions." };

  const admin = createAdminClient();
  const rows = groupRoles.map((role_key) => ({
    module_key: moduleKey,
    role_key,
    can_read: canRead,
    can_write: canWrite,
    updated_by: user.userId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("module_role_permissions")
    .upsert(rows, { onConflict: "module_key,role_key" });
  if (error) return { ok: false, error: error.message };

  revalidateTag("module-role-permissions");
  revalidatePath("/admin/role-permissions");
  return { ok: true };
}
