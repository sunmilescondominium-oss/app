"use server";

import { requireAuth } from "@/lib/auth/dal";
import { upsertAppSetting } from "@/lib/settings/app-settings";
import { revalidatePath } from "next/cache";

export interface SaveResult {
  success: boolean;
  error?: string;
}

function isSuperUser(allRoleKeys: string[]) {
  return allRoleKeys.some((r) =>
    ["admin", "managing_officer", "consultant"].includes(r),
  );
}

export async function saveAppSetting(formData: FormData): Promise<SaveResult> {
  try {
    const user = await requireAuth();
    if (!isSuperUser(user.allRoleKeys)) return { success: false, error: "Access denied." };

    const key = String(formData.get("key") ?? "").trim();
    const value = String(formData.get("value") ?? "").trim();
    if (!key || !value) return { success: false, error: "Missing key or value." };

    await upsertAppSetting(key, value, user.userId);
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error." };
  }
}

export async function restoreSetting(
  _historyId: number,
  key: string,
  value: string,
): Promise<SaveResult> {
  try {
    const user = await requireAuth();
    if (!isSuperUser(user.allRoleKeys)) return { success: false, error: "Access denied." };

    await upsertAppSetting(key, value, user.userId);
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error." };
  }
}
