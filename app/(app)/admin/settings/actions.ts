"use server";

import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { upsertAppSetting } from "@/lib/settings/app-settings";
import { revalidatePath } from "next/cache";

export async function saveAppSetting(formData: FormData) {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "managing_officer", "consultant"])) {
    throw new Error("Access denied.");
  }

  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!key || !value) return;

  await upsertAppSetting(key, value, user.userId);
  revalidatePath("/admin/settings");
}
