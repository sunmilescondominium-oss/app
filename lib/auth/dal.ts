import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  canReadModule,
  canWriteModule,
  setPermissionOverrides,
  ALL_ROLE_KEYS,
  SUPER_ROLES,
  type ModuleKey,
} from "@/lib/rbac/modules";
import { isModuleEnabled } from "@/lib/settings/flags";

const isSuper = (roleKeys: readonly string[]) => roleKeys.some((r) => SUPER_ROLES.includes(r));

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
  /** True when the user may preview/act as any role (admin). */
  canActAsAny: boolean;
  /** True when this session is a consultant impersonating another user. */
  impersonating: boolean;
  /** True when demo mode is active — new stays are tagged is_demo = true. */
  demoMode: boolean;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: roleRows }, { data: profile }, { data: permRows }] = await Promise.all([
    supabase.from("user_roles").select("role_key").eq("user_id", user.id),
    supabase.from("profiles").select("display_label, is_active").eq("id", user.id).maybeSingle(),
    supabase.from("role_permissions").select("role_key, module_key, can_read, can_write"),
  ]);

  // Disabled accounts get NO session — closes access immediately even while a
  // previously-issued access token is still technically unexpired.
  if (profile && profile.is_active === false) return null;

  const allRoleKeys = (roleRows ?? []).map((r) => r.role_key as string);

  // Load the global DB permission overrides into the RBAC layer for this request.
  setPermissionOverrides((permRows ?? []) as never);

  // "Act as / view as" is a granted capability — owner/admin/consultant by
  // default, or any role given the "actas" access in Access Control. Only those
  // holders may preview another role (never an escalation for the top roles).
  const canActAsAny = canReadModule(allRoleKeys, "actas");
  const cookieStore = await cookies();
  const requested = cookieStore.get("act_as_role")?.value ?? null;
  // setActAsRole validates role + hierarchy before writing the cookie, so any
  // cookie value that's a known role key is considered valid here.
  const validTarget =
    requested != null && (ALL_ROLE_KEYS as readonly string[]).includes(requested);
  const actingAs = validTarget ? requested : null;
  const demoMode = cookieStore.get("demo_mode")?.value === "1";

  return {
    userId: user.id,
    email: user.email ?? null,
    displayLabel: profile?.display_label ?? "Member",
    roleKeys: actingAs ? [actingAs] : allRoleKeys,
    allRoleKeys,
    actingAs,
    canActAsAny,
    impersonating: cookieStore.get("imp_active")?.value === "1",
    demoMode,
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
  if (!isSuper(user.roleKeys) && !(await isModuleEnabled(key))) redirect("/no-access");
  return user;
}

/** Requires the user to hold a role that may WRITE within the given module. */
export async function requireModuleWrite(key: ModuleKey): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canWriteModule(user.roleKeys, key)) redirect("/no-access");
  if (!isSuper(user.roleKeys) && !(await isModuleEnabled(key))) redirect("/no-access");
  return user;
}

export function userHasRole(user: SessionUser, role: string): boolean {
  return user.roleKeys.includes(role);
}

export function userHasAnyRole(user: SessionUser, roles: string[]): boolean {
  return roles.some((r) => user.roleKeys.includes(r));
}
