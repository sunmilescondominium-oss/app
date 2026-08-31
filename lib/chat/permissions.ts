/**
 * Role-to-role chat permission helpers.
 * Pairs are stored canonically (role_a < role_b alphabetically).
 * All lookups go through the DB table so admin can toggle pairs at runtime.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** Return the canonical key for a role pair (alphabetical order). */
export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Fetch all enabled pairs from the DB. Cached per-request via React cache if needed. */
export async function getEnabledPairs(): Promise<Array<{ role_a: string; role_b: string }>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("chat_role_permissions")
    .select("role_a, role_b")
    .eq("enabled", true);
  return data ?? [];
}

/** Given the caller's roles, return the set of role keys they are allowed to chat with. */
export async function getAllowedChatRoles(myRoles: string[]): Promise<Set<string>> {
  const pairs = await getEnabledPairs();
  const allowed = new Set<string>();
  for (const { role_a, role_b } of pairs) {
    if (myRoles.includes(role_a)) allowed.add(role_b);
    if (myRoles.includes(role_b)) allowed.add(role_a);
  }
  // Remove own roles from the allowed set (can't chat yourself)
  for (const r of myRoles) allowed.delete(r);
  return allowed;
}

/** Check whether role X can chat with role Y (either direction). */
export async function canChat(roleX: string, roleY: string): Promise<boolean> {
  if (roleX === roleY) return false;
  const [a, b] = pairKey(roleX, roleY);
  const admin = createAdminClient();
  const { data } = await admin
    .from("chat_role_permissions")
    .select("enabled")
    .eq("role_a", a)
    .eq("role_b", b)
    .maybeSingle();
  return data?.enabled === true;
}

/** Toggle (upsert) a role pair. Always stores in canonical order. */
export async function setChatPermission(
  roleX: string,
  roleY: string,
  enabled: boolean,
): Promise<void> {
  const [a, b] = pairKey(roleX, roleY);
  const admin = createAdminClient();
  await admin
    .from("chat_role_permissions")
    .upsert({ role_a: a, role_b: b, enabled }, { onConflict: "role_a,role_b" });
}

/** Fetch all pairs with their enabled status (for the admin UI). */
export async function getAllPairs(): Promise<Array<{ role_a: string; role_b: string; enabled: boolean }>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("chat_role_permissions")
    .select("role_a, role_b, enabled")
    .order("role_a")
    .order("role_b");
  return data ?? [];
}
