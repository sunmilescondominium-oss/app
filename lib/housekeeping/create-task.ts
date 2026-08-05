import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLEANING_CHECKLIST } from "@/lib/config";
import { resolveRoomType } from "./shift";

interface CreateArgs {
  unitId: string | null;
  stayId?: string | null;
  actorUserId?: string | null;
  via: string; // 'checkout' | 'lease_end' | 'rental_request' | ...
}

/**
 * Create the post-checkout cleaning task, stamping the room-type SLA (buffer to
 * start + target cleaning minutes + start_by deadline) and the per-room-type
 * checklist. Hotel & airbnb resolve a room type; other lines fall back to a
 * plain task with the standard checklist and no timer. Idempotent-ish: callers
 * should guard against an existing open task for the unit where needed.
 */
export async function createCleaningTask({ unitId, stayId = null, actorUserId = null, via }: CreateArgs): Promise<string | null> {
  const admin = createAdminClient();

  let businessLine: string | null = null;
  let unitType: string | null = null;
  if (unitId) {
    const { data: unit } = await admin.from("units").select("business_line, unit_type").eq("id", unitId).maybeSingle();
    businessLine = (unit?.business_line as string) ?? null;
    unitType = (unit?.unit_type as string) ?? null;
  }

  const rt = businessLine ? await resolveRoomType(businessLine, unitType) : null;
  const template = rt && rt.checklist.length ? rt.checklist : CLEANING_CHECKLIST.map((c) => ({ key: c.key, label: c.label }));
  const checklist = template.map((c) => ({ key: c.key, label: c.label, done: false }));

  const now = Date.now();
  const startBy = rt ? new Date(now + rt.buffer_minutes * 60_000).toISOString() : null;

  const { data: task } = await admin
    .from("housekeeping_tasks")
    .insert({
      unit_id: unitId,
      stay_id: stayId,
      status: "pending",
      checklist,
      business_line: businessLine,
      unit_type: unitType,
      room_type_id: rt?.id ?? null,
      buffer_minutes: rt?.buffer_minutes ?? null,
      cleaning_minutes: rt?.cleaning_minutes ?? null,
      start_by: startBy,
    })
    .select("id")
    .single();

  if (task) {
    await admin.from("housekeeping_events").insert({ task_id: task.id, event_type: "created", detail: { via }, actor_user_id: actorUserId });
  }
  return (task?.id as string) ?? null;
}
