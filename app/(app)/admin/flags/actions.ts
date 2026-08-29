"use server";

import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function toggleFlag(key: string, enabled: boolean) {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "managing_officer", "consultant"])) {
    throw new Error("Access denied.");
  }
  const admin = createAdminClient();
  await admin
    .from("feature_flags")
    .update({ enabled, updated_by_role: user.roleKeys[0] ?? "admin", updated_at: new Date().toISOString() })
    .eq("key", key);
  revalidatePath("/admin/flags");
}
