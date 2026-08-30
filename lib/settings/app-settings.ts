import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AppSetting {
  key: string;
  value: string;
  label: string;
  description: string | null;
  updated_at: string;
}

export interface AppSettingHistory {
  id: number;
  key: string;
  old_value: string | null;
  new_value: string;
  changed_by: string | null;
  changed_at: string;
}

export const getAppTimezone = cache(async (): Promise<string> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "timezone")
    .maybeSingle();
  return (data as { value: string } | null)?.value ?? "Asia/Manila";
});

export async function getAppSettings(): Promise<AppSetting[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("key, value, label, description, updated_at")
    .order("key");
  return (data ?? []) as AppSetting[];
}

export async function getAllSettingHistory(): Promise<Record<string, AppSettingHistory[]>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings_history")
    .select("id, key, old_value, new_value, changed_by, changed_at")
    .order("changed_at", { ascending: false })
    .limit(100);

  const grouped: Record<string, AppSettingHistory[]> = {};
  for (const entry of (data ?? []) as AppSettingHistory[]) {
    if (!grouped[entry.key]) grouped[entry.key] = [];
    if (grouped[entry.key].length < 5) grouped[entry.key].push(entry);
  }
  return grouped;
}

export async function upsertAppSetting(
  key: string,
  value: string,
  updatedBy: string,
): Promise<void> {
  const admin = createAdminClient();

  // Archive current value before overwriting
  const { data: current } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (current) {
    await admin.from("app_settings_history").insert({
      key,
      old_value: (current as { value: string }).value,
      new_value: value,
      changed_by: updatedBy,
    });
  }

  const { error } = await admin
    .from("app_settings")
    .update({ value, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) {
    console.error("[app-settings] update error:", error);
    throw new Error(`Failed to save setting: ${error.message}`);
  }
}
