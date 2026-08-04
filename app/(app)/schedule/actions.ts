"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BulkResult = { ok: true; count: number; days: number } | { ok: false; error: string };

const MAX_ROWS = 3000;

/**
 * Bulk-assign a shift to several staff over a date range, on chosen weekdays.
 * overwrite=false skips days a staff already has a shift; overwrite=true replaces them.
 */
export async function bulkAssignShifts(_prev: BulkResult | undefined, formData: FormData): Promise<BulkResult> {
  const user = await requireModuleWrite("scheduling");
  const userIds = [...new Set(formData.getAll("user_ids").map(String).filter(Boolean))];
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const start_time = String(formData.get("start_time") ?? "") || null;
  const end_time = String(formData.get("end_time") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const weekdays = new Set(formData.getAll("weekday").map((v) => Number(v))); // 0=Sun … 6=Sat
  const overwrite = formData.get("overwrite") != null;

  if (!userIds.length) return { ok: false, error: "Select at least one staff member." };
  if (!from || !to) return { ok: false, error: "Choose the date range." };
  if (from > to) return { ok: false, error: "The From date must be on or before the To date." };
  if (!weekdays.size) return { ok: false, error: "Select at least one weekday." };

  // Build the list of matching dates (noon-UTC avoids timezone edge cases).
  const dates: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    if (weekdays.has(d.getUTCDay())) dates.push(d.toISOString().slice(0, 10));
  }
  if (!dates.length) return { ok: false, error: "No dates in the range match the chosen weekdays." };
  if (dates.length * userIds.length > MAX_ROWS) return { ok: false, error: `That's ${dates.length * userIds.length} assignments — narrow the range or staff (max ${MAX_ROWS}).` };

  const rows = userIds.flatMap((uid) =>
    dates.map((work_date) => ({ user_id: uid, work_date, start_time, end_time, note, created_by: user.userId })),
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_schedules")
    .upsert(rows, { onConflict: "user_id,work_date", ignoreDuplicates: !overwrite });
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "shift_schedules", entityId: `bulk:${from}..${to}`, diff: { staff: userIds.length, days: dates.length, overwrite } });
  revalidatePath("/schedule");
  return { ok: true, count: rows.length, days: dates.length };
}

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
