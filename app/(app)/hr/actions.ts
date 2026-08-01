"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { PayrollSettings } from "@/lib/hr/payroll";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Set a staff member's DAILY rate (accounting / admin). */
export async function setStaffPay(userId: string, dailyRate: number): Promise<ActionResult> {
  const user = await requireModuleWrite("hr");
  if (!userId) return { ok: false, error: "Missing staff." };
  if (!Number.isFinite(dailyRate) || dailyRate < 0) return { ok: false, error: "Enter a valid daily rate." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_pay")
    .upsert({ user_id: userId, daily_rate: dailyRate, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "staff_pay",
    entityId: userId,
    diff: { daily_rate: dailyRate },
  });
  revalidatePath("/hr");
  return { ok: true };
}

/** Update the org-wide payroll schedule / premium settings (accounting / admin). */
export async function setPayrollSettings(input: PayrollSettings): Promise<ActionResult> {
  const user = await requireModuleWrite("hr");

  const n = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
  if (!n(input.standard_hours, 1, 24)) return { ok: false, error: "Standard hours must be 1–24." };
  if (!n(input.break_hours, 0, 8)) return { ok: false, error: "Break hours must be 0–8." };
  if (!n(input.grace_minutes, 0, 120)) return { ok: false, error: "Grace minutes must be 0–120." };
  if (!n(input.ot_multiplier, 1, 5)) return { ok: false, error: "OT multiplier must be 1–5." };
  if (!n(input.night_diff_rate, 0, 1)) return { ok: false, error: "Night diff rate must be 0–1." };
  if (!n(input.half_day_hours, 0, 24)) return { ok: false, error: "Half-day hours must be 0–24." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_settings")
    .update({
      scheduled_time_in: input.scheduled_time_in,
      standard_hours: input.standard_hours,
      break_hours: input.break_hours,
      grace_minutes: input.grace_minutes,
      ot_multiplier: input.ot_multiplier,
      night_diff_rate: input.night_diff_rate,
      night_start: input.night_start,
      night_end: input.night_end,
      half_day_hours: input.half_day_hours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "payroll_settings",
    entityId: "1",
    diff: { ...input },
  });
  revalidatePath("/hr");
  return { ok: true };
}
