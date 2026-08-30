"use server";

import { requireAuth } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface ToggleResult {
  ok: boolean;
  error?: string;
}

export async function toggleFlag(key: string, enabled: boolean): Promise<ToggleResult> {
  try {
    const user = await requireAuth();
    const isSuper = user.allRoleKeys.some((r) =>
      ["admin", "managing_officer", "consultant"].includes(r),
    );
    if (!isSuper) return { ok: false, error: "Access denied." };

    const admin = createAdminClient();

    // Read current state before overwriting
    const { data: current } = await admin
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();

    const oldEnabled = (current as { enabled: boolean } | null)?.enabled ?? !enabled;

    // Archive the change
    await admin.from("feature_flags_history").insert({
      key,
      old_enabled: oldEnabled,
      new_enabled: enabled,
      changed_by: user.userId,
      changed_by_role: user.roleKeys[0] ?? "admin",
    });

    // Apply the toggle
    const { error } = await admin
      .from("feature_flags")
      .update({
        enabled,
        updated_by_role: user.roleKeys[0] ?? "admin",
        updated_at: new Date().toISOString(),
      })
      .eq("key", key);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/flags");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error." };
  }
}
