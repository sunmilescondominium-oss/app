import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";
import type { RoomTypeConfig } from "./types";

/** PH is UTC+8, no DST — build an ISO instant from a Manila date + time. */
function manilaInstant(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time; // HH:MM -> HH:MM:SS
  return new Date(`${date}T${t}+08:00`).toISOString();
}

/**
 * The signed-in attendant's scheduled shift-end today (ISO), or null when they
 * have no schedule row. Used to decide which rooms can still be started vs.
 * must be endorsed to the next team.
 */
export async function getShiftEndToday(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const day = todayManila();
  const { data } = await supabase
    .from("shift_schedules")
    .select("end_time")
    .eq("user_id", userId)
    .eq("work_date", day)
    .maybeSingle();
  if (!data?.end_time) return null;
  return manilaInstant(day, data.end_time as string);
}

/**
 * Resolve the room-type config for a unit's business line + type. Falls back to
 * the business line's default row (unit_type NULL), then null. SERVICE ROLE so
 * it works from the checkout path regardless of the caller's RLS.
 */
export async function resolveRoomType(businessLine: string, unitType: string | null): Promise<RoomTypeConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("housekeeping_room_types")
    .select("*")
    .eq("business_line", businessLine)
    .eq("is_active", true);
  const rows = data ?? [];
  const exact = unitType ? rows.find((r) => r.unit_type === unitType) : null;
  const fallback = rows.find((r) => r.unit_type == null);
  const r = exact ?? fallback ?? null;
  if (!r) return null;
  return {
    id: r.id as string,
    business_line: r.business_line as string,
    unit_type: (r.unit_type as string) ?? null,
    label: r.label as string,
    buffer_minutes: Number(r.buffer_minutes),
    cleaning_minutes: Number(r.cleaning_minutes),
    checklist: Array.isArray(r.checklist) ? (r.checklist as { key: string; label: string }[]) : [],
    is_active: Boolean(r.is_active),
    sort_order: Number(r.sort_order),
  };
}

/**
 * Given a task's target cleaning minutes and the attendant's shift end, decide
 * whether they can still START it now (enough time to finish before shift end).
 * When there is no shift end on file we don't restrict (return true).
 */
export function canStartBeforeShiftEnd(cleaningMinutes: number | null, shiftEndIso: string | null, now = new Date()): boolean {
  if (!shiftEndIso) return true;
  const mins = cleaningMinutes && cleaningMinutes > 0 ? cleaningMinutes : 45;
  const finishBy = new Date(now.getTime() + mins * 60_000);
  return finishBy.getTime() <= new Date(shiftEndIso).getTime();
}
