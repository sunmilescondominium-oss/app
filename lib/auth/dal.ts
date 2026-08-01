import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  canReadModule,
  canWriteModule,
  type ModuleKey,
} from "@/lib/rbac/modules";

/**
 * Data Access Layer — the authoritative auth boundary.
 *
 * getSessionUser() runs the SECURE check (supabase.auth.getUser() validates the
 * JWT with the Auth server) and loads the user's roles. It is wrapped in
 * React.cache so multiple calls in one render pass hit Supabase once.
 *
 * Prime directive: authorization is by ROLE, never by person. Callers ask
 * "does this user hold a role that may read/write module X", never "who is it".
 */

export interface SessionUser {
  userId: string;
  email: string | null;
  displayLabel: string;
  /** Effective roles — may be narrowed to one via the "Act as role" switcher. */
  roleKeys: string[];
  /** All roles the user actually holds. */
  allRoleKeys: string[];
  /** The role currently being acted-as, or null. */
  actingAs: string | null;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role_key").eq("user_id", user.id),
    supabase.from("profiles").select("display_label").eq("id", user.id).maybeSingle(),
  ]);
  const allRoleKeys = (roleRows ?? []).map((r) => r.role_key as string);

  // "Act as role" — restrict to a single held role (never an escalation).
  const cookieStore = await cookies();
  const requested = cookieStore.get("act_as_role")?.value ?? null;
  const actingAs = requested && allRoleKeys.includes(requested) ? requested : null;

  return {
    userId: user.id,
    email: user.email ?? null,
    displayLabel: profile?.display_label ?? "Member",
    roleKeys: actingAs ? [actingAs] : allRoleKeys,
    allRoleKeys,
    actingAs,
  };
});

/** Redirects to /login when there is no authenticated user. */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires the user to hold a role that may READ the given module. */
export async function requireModule(key: ModuleKey): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canReadModule(user.roleKeys, key)) redirect("/no-access");
  return user;
}

/** Requires the user to hold a role that may WRITE within the given module. */
export async function requireModuleWrite(key: ModuleKey): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canWriteModule(user.roleKeys, key)) redirect("/no-access");
  return user;
}

export function userHasRole(user: SessionUser, role: string): boolean {
  return user.roleKeys.includes(role);
}

export function userHasAnyRole(user: SessionUser, roles: string[]): boolean {
  return roles.some((r) => user.roleKeys.includes(r));
}
