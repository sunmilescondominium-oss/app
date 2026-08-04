"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { logAudit } from "@/lib/audit";
import { ALL_ROLE_KEYS } from "@/lib/rbac/modules";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Admin triggers a password-reset email for a staff member (locked-out help). */
export async function sendUserPasswordReset(email: string): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  const addr = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return { ok: false, error: "Invalid email." };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: `${origin}/auth/reset` });
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "auth.users", entityId: addr, diff: { password_reset_sent: true } });
  return { ok: true };
}

const VALID_ROLES: readonly string[] = ALL_ROLE_KEYS;

function cleanRoles(roleKeys: string[]): string[] {
  return Array.from(new Set(roleKeys.filter((r) => VALID_ROLES.includes(r))));
}

/** Replace a user's entire role set (task-based access). */
export async function setUserRoles(
  userId: string,
  roleKeys: string[],
): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  const admin = createAdminClient();
  const roles = cleanRoles(roleKeys);

  const { error: delErr } = await admin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (delErr) return { ok: false, error: delErr.message };

  if (roles.length > 0) {
    const rows = roles.map((rk) => ({ user_id: userId, role_key: rk }));
    const { error: insErr } = await admin.from("user_roles").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  await logAudit({
    actorUserId: actor.userId,
    actorRoles: actor.roleKeys,
    action: "update",
    entity: "user_roles",
    entityId: userId,
    diff: { roleKeys: roles },
  });
  revalidatePath("/users");
  return { ok: true };
}

export async function createUser(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayLabel = String(formData.get("display_label") ?? "").trim() || "New Member";
  const roles = cleanRoles(formData.getAll("roles").map(String));

  if (!email) return { ok: false, error: "Email is required." };
  if (password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters." };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_label: displayLabel },
  });
  if (error) return { ok: false, error: error.message };
  const userId = data.user?.id;
  if (!userId) return { ok: false, error: "Could not create the user." };

  // Profile is created by the on-auth-user-created trigger; set label + roles.
  await admin.from("profiles").update({ display_label: displayLabel }).eq("id", userId);
  if (roles.length > 0) {
    await admin.from("user_roles").insert(roles.map((rk) => ({ user_id: userId, role_key: rk })));
  }

  await logAudit({
    actorUserId: actor.userId,
    actorRoles: actor.roleKeys,
    action: "create",
    entity: "profiles",
    entityId: userId,
    diff: { email, roleKeys: roles },
  });
  revalidatePath("/users");
  return { ok: true };
}

export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: actor.userId,
    actorRoles: actor.roleKeys,
    action: "update",
    entity: "profiles",
    entityId: userId,
    diff: { is_active: active },
  });
  revalidatePath("/users");
  return { ok: true };
}
