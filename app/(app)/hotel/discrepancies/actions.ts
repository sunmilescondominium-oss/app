"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SUPERVISOR_ROLES = [
  "hotel_cashier", "hotel_rental_monitoring", "admin", "managing_officer", "consultant",
] as const;

export async function resolveGuardAlert(alertId: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...SUPERVISOR_ROLES]))
    return { ok: false, error: "Access denied." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("hotel_guard_alerts")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user.userId,
    })
    .eq("id", alertId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hotel/discrepancies");
  revalidatePath("/hotel");
  return { ok: true };
}
