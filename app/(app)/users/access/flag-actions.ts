"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const TOGGLE_ROLES = ["admin", "managing_officer", "operations_manager"];

/** Enable/disable a feature flag (e.g. the Cash Advance module). */
export async function setFeatureFlag(key: string, enabled: boolean): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, TOGGLE_ROLES))
    return { ok: false, error: "Only an admin or immediate supervisor can change this." };

  const actorRole = TOGGLE_ROLES.find((r) => user.roleKeys.includes(r)) ?? user.roleKeys[0];
  const admin = createAdminClient();
  const { error } = await admin
    .from("feature_flags")
    .update({ enabled, updated_by_role: actorRole, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "feature_flags", entityId: key, diff: { enabled } });
  revalidatePath("/", "layout"); // nav + gated pages depend on this
  return { ok: true };
}
