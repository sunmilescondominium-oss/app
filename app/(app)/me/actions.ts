"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { LEAVE_TYPES } from "@/lib/config";
import { todayManila } from "@/lib/collections/summary";

export type ActionResult = { ok: true } | { ok: false; error: string };

const LEAVE_SET: readonly string[] = LEAVE_TYPES;

/** Employee submits a leave request (self-service). */
export async function requestLeave(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModule("employee");

  const leave_type = String(formData.get("leave_type") ?? "");
  const start_date = String(formData.get("start_date") ?? "");
  const end_date = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!LEAVE_SET.includes(leave_type)) return { ok: false, error: "Choose a leave type." };
  if (!start_date || !end_date) return { ok: false, error: "Enter start and end dates." };
  if (end_date < start_date) return { ok: false, error: "End date is before start date." };
  if (start_date < todayManila()) return { ok: false, error: "Start date cannot be in the past." };

  const days = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / 86_400_000) + 1;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({ user_id: user.userId, leave_type, start_date, end_date, days, reason })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "leave_requests",
    entityId: data.id,
    diff: { leave_type, start_date, end_date, days },
  });
  revalidatePath("/me");
  revalidatePath("/employees");
  revalidatePath("/owner");
  return { ok: true };
}

/** Employee files an Official Business request (approval workflow, like leave). */
export async function requestOB(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModule("employee");

  const start_date = String(formData.get("start_date") ?? "");
  const end_date = String(formData.get("end_date") ?? "") || start_date;
  const duration = String(formData.get("duration") ?? "whole_day");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!start_date) return { ok: false, error: "Enter the OB date." };
  if (end_date < start_date) return { ok: false, error: "End date is before start date." };
  if (start_date < todayManila()) return { ok: false, error: "OB date cannot be in the past." };
  if (duration !== "whole_day" && duration !== "half_day") return { ok: false, error: "Choose whole or half day." };

  const spanDays = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / 86_400_000) + 1;
  const days = duration === "half_day" ? 0.5 : spanDays;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({ user_id: user.userId, category: "ob", leave_type: "Official Business", duration, start_date, end_date, days, reason })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "leave_requests",
    entityId: data.id,
    diff: { category: "ob", duration, start_date, end_date },
  });
  revalidatePath("/me");
  revalidatePath("/employees");
  revalidatePath("/owner");
  return { ok: true };
}

/** Overtime / undertime / other request (same approval workflow). */
export async function requestGeneral(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModule("employee");

  const category = String(formData.get("category") ?? "");
  const date = String(formData.get("date") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const hoursRaw = String(formData.get("hours") ?? "");

  if (!["overtime", "undertime", "other"].includes(category)) return { ok: false, error: "Choose a request type." };
  if (!date) return { ok: false, error: "Enter the date." };

  let hours: number | null = null;
  if (category !== "other") {
    hours = Number(hoursRaw);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return { ok: false, error: "Enter valid hours (1–24)." };
  }
  const leave_type = category === "other" ? subject || "Other request" : category === "overtime" ? "Overtime" : "Undertime";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({ user_id: user.userId, category, leave_type, start_date: date, end_date: date, days: 0, hours, reason })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "leave_requests",
    entityId: data.id,
    diff: { category, date, hours },
  });
  revalidatePath("/me");
  revalidatePath("/employees");
  revalidatePath("/owner");
  return { ok: true };
}

/** Employee cancels their own still-pending request. */
export async function cancelLeave(id: string): Promise<ActionResult> {
  const user = await requireModule("employee");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.userId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}
