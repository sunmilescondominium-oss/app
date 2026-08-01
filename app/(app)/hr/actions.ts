"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Set a staff member's hourly rate (accounting / admin). */
export async function setStaffPay(userId: string, hourlyRate: number): Promise<ActionResult> {
  const user = await requireModuleWrite("hr");
  if (!userId) return { ok: false, error: "Missing staff." };
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return { ok: false, error: "Enter a valid rate." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_pay")
    .upsert({ user_id: userId, hourly_rate: hourlyRate, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "staff_pay",
    entityId: userId,
    diff: { hourly_rate: hourlyRate },
  });
  revalidatePath("/hr");
  return { ok: true };
}
