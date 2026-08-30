import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ModuleKey } from "@/lib/rbac/modules";

export interface FeatureFlag {
  key: string;
  label: string;
  enabled: boolean;
  updated_by_role: string | null;
  updated_at: string;
}

/** Modules that are gated behind a feature flag. */
export const MODULE_FLAG: Partial<Record<ModuleKey, string>> = {
  advances: "cash_advance",
};

/** All feature flags, memoised per request. */
export const getFeatureFlags = cache(async (): Promise<Map<string, boolean>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("feature_flags").select("key, enabled");
  const map = new Map<string, boolean>();
  for (const r of data ?? []) map.set(r.key as string, r.enabled as boolean);
  return map;
});

export async function isFeatureEnabled(key: string): Promise<boolean> {
  return (await getFeatureFlags()).get(key) ?? false;
}

/**
 * Housekeeping hard-stop: block "Mark room ready" until the checklist is done
 * and standard materials are recorded. Defaults ON (hard stop) when unset.
 */
export async function isHousekeepingHardStop(): Promise<boolean> {
  return (await getFeatureFlags()).get("housekeeping_hard_stop") ?? true;
}

/** True when a module is either not gated, or gated by an enabled flag. */
export async function isModuleEnabled(key: ModuleKey): Promise<boolean> {
  const flag = MODULE_FLAG[key];
  if (!flag) return true;
  return isFeatureEnabled(flag);
}

export interface FlagHistory {
  id: number;
  key: string;
  old_enabled: boolean;
  new_enabled: boolean;
  changed_by: string | null;
  changed_by_role: string | null;
  changed_at: string;
}

export async function getAllFlagHistory(): Promise<Record<string, FlagHistory[]>> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("feature_flags_history")
    .select("id, key, old_enabled, new_enabled, changed_by, changed_by_role, changed_at")
    .order("changed_at", { ascending: false })
    .limit(100);

  const grouped: Record<string, FlagHistory[]> = {};
  for (const entry of (data ?? []) as FlagHistory[]) {
    if (!grouped[entry.key]) grouped[entry.key] = [];
    if (grouped[entry.key].length < 5) grouped[entry.key].push(entry);
  }
  return grouped;
}

/** Full flag rows for the admin settings UI (service-safe read via RLS). */
export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("feature_flags").select("*").order("label");
  return (data ?? []).map((r) => ({
    key: r.key as string,
    label: r.label as string,
    enabled: r.enabled as boolean,
    updated_by_role: (r.updated_by_role as string) ?? null,
    updated_at: r.updated_at as string,
  }));
}
