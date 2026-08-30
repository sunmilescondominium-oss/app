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

export async function upsertAppSetting(
  key: string,
  value: string,
  updatedBy: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .update({ value, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) {
    console.error("[app-settings] update error:", error);
    throw new Error(`Failed to save setting: ${error.message}`);
  }
}
