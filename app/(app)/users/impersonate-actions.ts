"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPER_ROLES } from "@/lib/rbac/modules";
import { logAudit } from "@/lib/audit";

export type ImpResult = { ok: true } | { ok: false; error: string };

const RETURN_COOKIE = "imp_return"; // consultant's own refresh token (to come back)
const ACTIVE_COOKIE = "imp_active";

function isConsultant(roleKeys: readonly string[]): boolean {
  return roleKeys.some((r) => SUPER_ROLES.includes(r));
}

/**
 * Consultant-only: become another user's real session for testing. Stashes the
 * consultant's own refresh token so exitImpersonation() can restore it.
 */
export async function signInAsUser(targetUserId: string): Promise<ImpResult> {
  const me = await requireAuth();
  if (!isConsultant(me.allRoleKeys)) return { ok: false, error: "Only the consultant may sign in as another user." };
  if (me.impersonating) return { ok: false, error: "Already impersonating — exit first." };
  if (targetUserId === me.userId) return { ok: false, error: "That's already you." };

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const myRefresh = session?.refresh_token;
  if (!myRefresh) return { ok: false, error: "Could not read your session." };

  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(targetUserId);
  const email = target?.user?.email;
  if (!email) return { ok: false, error: "Target user has no email." };

  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) return { ok: false, error: error?.message ?? "Could not start impersonation." };

  const jar = await cookies();
  jar.set(RETURN_COOKIE, myRefresh, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
  jar.set(ACTIVE_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
  jar.delete("act_as_role");

  const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (vErr) {
    jar.delete(RETURN_COOKIE);
    jar.delete(ACTIVE_COOKIE);
    return { ok: false, error: vErr.message };
  }

  await logAudit({ actorUserId: me.userId, actorRoles: me.roleKeys, action: "update", entity: "impersonation", entityId: targetUserId, diff: { signed_in_as: email } });
  redirect("/");
}

/** Return to the consultant's own account. */
export async function exitImpersonation(): Promise<void> {
  const jar = await cookies();
  const myRefresh = jar.get(RETURN_COOKIE)?.value;
  const supabase = await createClient();
  if (myRefresh) {
    await supabase.auth.refreshSession({ refresh_token: myRefresh });
  } else {
    await supabase.auth.signOut();
  }
  jar.delete(RETURN_COOKIE);
  jar.delete(ACTIVE_COOKIE);
  jar.delete("act_as_role");
  redirect("/");
}
