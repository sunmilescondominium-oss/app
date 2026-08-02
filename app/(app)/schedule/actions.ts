"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Assign (or update) a staff member's shift on a date. One shift per day. */
export async function assignShift(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("scheduling");
  const userId = String(formData.get("user_id") ?? "");
  const work_date = String(formData.get("work_date") ?? "");
  const start_time = String(formData.get("start_time") ?? "") || null;
  const end_time = String(formData.get("end_time") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!userId || !work_date) return { ok: false, error: "Choose a staff member and date." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_schedules")
    .upsert(
      { user_id: userId, work_date, start_time, end_time, note, created_by: user.userId },
      { onConflict: "user_id,work_date" },
    );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "shift_schedules",
    entityId: `${userId}:${work_date}`,
    diff: { work_date, start_time, end_time },
  });
  revalidatePath("/schedule");
  return { ok: true };
}

/** One-click assign using the org default schedule (for the weekly grid). */
export async function quickAssignShift(userId: string, workDate: string): Promise<ActionResult> {
  const user = await requireModuleWrite("scheduling");
  if (!userId || !workDate) return { ok: false, error: "Missing staff or date." };

  const { getPayrollSettings } = await import("@/lib/hr/queries");
  const s = await getPayrollSettings();
  const start = s.scheduled_time_in.slice(0, 5);
  const [h, m] = start.split(":").map(Number);
  const endMins = (h * 60 + m + (s.standard_hours + s.break_hours) * 60) % (24 * 60);
  const end = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;

  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_schedules")
    .upsert({ user_id: userId, work_date: workDate, start_time: start, end_time: end, created_by: user.userId }, { onConflict: "user_id,work_date" });
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "shift_schedules", entityId: `${userId}:${workDate}`, diff: { quick: true, start, end } });
  revalidatePath("/schedule");
  return { ok: true };
}

export async function removeShift(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("scheduling");
  const supabase = await createClient();
  const { error } = await supabase.from("shift_schedules").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "shift_schedules", entityId: id });
  revalidatePath("/schedule");
  return { ok: true };
}
