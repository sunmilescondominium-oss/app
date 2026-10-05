"use server";

import { requireAuth } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const ALLOWED_ROLES = ["admin", "accounting", "hotel_rental_monitoring"];
const FLAG_KEY = "hotel_rate_plan_lock";

export async function toggleRatePlanLock(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const allowed = user.allRoleKeys.some((r) => ALLOWED_ROLES.includes(r));
    if (!allowed) return { ok: false, error: "Access denied." };

    const admin = createAdminClient();

    const { data: current } = await admin
      .from("feature_flags")
      .select("enabled")
      .eq("key", FLAG_KEY)
      .maybeSingle();

    const oldEnabled = (current as { enabled: boolean } | null)?.enabled ?? !enabled;

    await admin.from("feature_flags_history").insert({
      key: FLAG_KEY,
      old_enabled: oldEnabled,
      new_enabled: enabled,
      changed_by: user.userId,
      changed_by_role: user.roleKeys[0] ?? "admin",
    });

    const { error } = await admin
      .from("feature_flags")
      .update({ enabled, updated_by_role: user.roleKeys[0] ?? "admin", updated_at: new Date().toISOString() })
      .eq("key", FLAG_KEY);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/hotel");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error." };
  }
}
