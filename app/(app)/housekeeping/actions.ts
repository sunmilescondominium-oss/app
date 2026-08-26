"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { CLEANING_CHECKLIST } from "@/lib/config";
import { getShiftEndToday, canStartBeforeShiftEnd } from "@/lib/housekeeping/shift";
import type { HKChecklistItem } from "@/lib/housekeeping/types";
import type { ImportResult } from "@/lib/imports/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Bulk-import / update room supplies from CSV (upsert by unique name). */
export async function bulkImportSupplies(rows: Record<string, string>[]): Promise<ImportResult> {
  const user = await requireModuleWrite("housekeeping");
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 2000) return { ok: false, error: "Too many rows (max 2000)." };
  const admin = createAdminClient();
  const errors: { row: number; error: string }[] = [];
  const toUpsert: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const name = (r.name ?? "").trim();
    if (!name) { errors.push({ row: line, error: "name is required" }); continue; }
    toUpsert.push({
      name,
      unit_label: (r.unit_label ?? "pcs").trim() || "pcs",
      stock_qty: r.stock_qty ? Number(r.stock_qty) : 0,
      reorder_level: r.reorder_level ? Number(r.reorder_level) : 0,
      sort_order: r.sort_order ? Math.trunc(Number(r.sort_order)) : 100,
    });
  }
  let inserted = 0;
  if (toUpsert.length) {
    const { error } = await admin.from("room_supplies").upsert(toUpsert, { onConflict: "name" });
    if (error) return { ok: false, error: error.message };
    inserted = toUpsert.length;
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "room_supplies", entityId: null, diff: { imported: inserted, skipped: errors.length } });
  revalidatePath("/housekeeping");
  return { ok: true, inserted, errors: errors.length ? errors : undefined };
}

function attendantRole(roleKeys: string[]): string {
  return roleKeys.includes("room_attendant") ? "room_attendant" : roleKeys[0] ?? "room_attendant";
}

type MovementReason = "issue" | "receive" | "adjust" | "count" | "replacement";

/** Append a stock-movement audit row (service role). */
async function logMovement(
  admin: ReturnType<typeof createAdminClient>,
  args: { supplyId: string; delta: number; reason: MovementReason; balanceAfter: number; userId: string; role: string; note?: string | null; refTask?: string | null },
): Promise<void> {
  await admin.from("stock_movements").insert({
    supply_id: args.supplyId,
    delta: args.delta,
    reason: args.reason,
    balance_after: args.balanceAfter,
    actor_user_id: args.userId,
    actor_role: args.role,
    note: args.note ?? null,
    ref_task: args.refTask ?? null,
  });
}

/** Dispense/issue a supply for an operation — logged against the staff. */
export async function issueStock(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const supplyId = String(formData.get("supply_id") ?? "").trim();
  const qty = Number(formData.get("qty") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!supplyId || !Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Choose a supply and quantity." };

  const admin = createAdminClient();
  const { data: sup } = await admin.from("room_supplies").select("stock_qty").eq("id", supplyId).maybeSingle();
  if (!sup) return { ok: false, error: "Supply not found." };
  const balanceAfter = Math.max(0, Number(sup.stock_qty) - qty);
  await admin.from("room_supplies").update({ stock_qty: balanceAfter }).eq("id", supplyId);
  await logMovement(admin, { supplyId, delta: -qty, reason: "issue", balanceAfter, userId: user.userId, role: attendantRole(user.roleKeys), note });
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "room_supplies", entityId: supplyId, diff: { issued: qty } });
  revalidatePath("/housekeeping");
  return { ok: true };
}

/** Receive stock (delivery) — admin / operations. */
export async function receiveStock(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "operations_manager", "managing_officer"])) return { ok: false, error: "Only admin/operations can receive stock." };
  const supplyId = String(formData.get("supply_id") ?? "").trim();
  const qty = Number(formData.get("qty") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!supplyId || !Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Choose a supply and quantity." };

  const admin = createAdminClient();
  const { data: sup } = await admin.from("room_supplies").select("stock_qty").eq("id", supplyId).maybeSingle();
  if (!sup) return { ok: false, error: "Supply not found." };
  const balanceAfter = Number(sup.stock_qty) + qty;
  await admin.from("room_supplies").update({ stock_qty: balanceAfter }).eq("id", supplyId);
  await logMovement(admin, { supplyId, delta: qty, reason: "receive", balanceAfter, userId: user.userId, role: firstStaffRole(user.roleKeys), note });
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "room_supplies", entityId: supplyId, diff: { received: qty } });
  revalidatePath("/housekeeping");
  return { ok: true };
}

/** Periodical physical count — set stock to the counted quantity, log variance. */
export async function physicalCount(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "operations_manager", "managing_officer"])) return { ok: false, error: "Only admin/operations can record a count." };
  const supplyId = String(formData.get("supply_id") ?? "").trim();
  const counted = Number(formData.get("counted") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!supplyId || !Number.isFinite(counted) || counted < 0) return { ok: false, error: "Enter the counted quantity." };

  const admin = createAdminClient();
  const { data: sup } = await admin.from("room_supplies").select("stock_qty").eq("id", supplyId).maybeSingle();
  if (!sup) return { ok: false, error: "Supply not found." };
  const variance = Math.round((counted - Number(sup.stock_qty)) * 100) / 100;
  await admin.from("room_supplies").update({ stock_qty: counted }).eq("id", supplyId);
  await logMovement(admin, { supplyId, delta: variance, reason: "count", balanceAfter: counted, userId: user.userId, role: firstStaffRole(user.roleKeys), note: `${note ? note + " · " : ""}variance ${variance >= 0 ? "+" : ""}${variance}` });
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "room_supplies", entityId: supplyId, diff: { counted, variance } });
  revalidatePath("/housekeeping");
  return { ok: true };
}

function firstStaffRole(roleKeys: string[]): string {
  return roleKeys.find((r) => ["admin", "operations_manager", "managing_officer", "warehouse_timekeeper"].includes(r)) ?? roleKeys[0] ?? "admin";
}

/** Attach post-cleaning photos (bed, toilet, room, …) to a housekeeping task. */
export async function uploadHousekeepingPhoto(taskId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const photo = formData.get("photo");
  const area = String(formData.get("area") ?? "").trim() || "room";
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, error: "Choose a photo." };
  if (photo.size > 8 * 1024 * 1024) return { ok: false, error: "Photo too large (max 8 MB)." };

  const admin = createAdminClient();
  const path = `${taskId}/${area}-${Date.now()}.jpg`;
  const up = await admin.storage.from("housekeeping-photos").upload(path, new Uint8Array(await photo.arrayBuffer()), { contentType: photo.type || "image/jpeg" });
  if (up.error) return { ok: false, error: up.error.message };

  const { data: task } = await admin.from("housekeeping_tasks").select("photos").eq("id", taskId).maybeSingle();
  const photos = Array.isArray(task?.photos) ? (task!.photos as string[]) : [];
  photos.push(path);
  const { error } = await admin.from("housekeeping_tasks").update({ photos }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "housekeeping_tasks", entityId: taskId, diff: { photo_area: area } });
  revalidatePath(`/housekeeping/${taskId}`);
  return { ok: true };
}

export async function startTask(taskId: string, shift: string): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const supabase = await createClient();
  const role = attendantRole(user.roleKeys);

  const { data: task } = await supabase.from("housekeeping_tasks").select("status, cleaning_minutes").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "Task not found." };
  if (task.status !== "pending") return { ok: false, error: "This room is already being cleaned." };

  // Shift-end cutoff: an attendant may only start a room they can finish before
  // their shift ends (no overtime, no mid-clean handoff). If not, the room is
  // endorsed to the next team instead of started.
  const shiftEnd = await getShiftEndToday(user.userId);
  if (!canStartBeforeShiftEnd(task.cleaning_minutes as number | null, shiftEnd)) {
    await supabase.from("housekeeping_tasks").update({ endorsed: true, endorsed_at: new Date().toISOString() }).eq("id", taskId);
    await supabase.from("housekeeping_events").insert({ task_id: taskId, event_type: "endorsed", detail: { reason: "shift_end_cutoff" }, actor_role: role, actor_user_id: user.userId });
    revalidatePath("/housekeeping");
    revalidatePath(`/housekeeping/${taskId}`);
    return { ok: false, error: "Not enough time left in your shift to finish this room — it has been endorsed to the next team." };
  }

  const { error } = await supabase
    .from("housekeeping_tasks")
    .update({ status: "in_progress", started_at: new Date().toISOString(), assigned_to_role: role, shift: shift || null, endorsed: false, endorsed_at: null })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("housekeeping_events").insert({ task_id: taskId, event_type: "started", detail: { shift }, actor_role: role, actor_user_id: user.userId });
  revalidatePath("/housekeeping");
  revalidatePath(`/housekeeping/${taskId}`);
  return { ok: true };
}

/**
 * Escalate a room the attendant genuinely cannot finish once started (needs a
 * repair, missing supply, illness). Not a normal turnover — it flags the task
 * for monitoring/operations to resolve and is fully logged. The room stays
 * in-progress and does NOT count as ready.
 */
export async function escalateTask(taskId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, error: "Please say why the room can't be finished." };
  const supabase = await createClient();
  const role = attendantRole(user.roleKeys);
  const { error } = await supabase.from("housekeeping_tasks").update({ escalated: true, escalation_note: reason }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("housekeeping_events").insert({ task_id: taskId, event_type: "escalated", detail: { reason }, actor_role: role, actor_user_id: user.userId });
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "housekeeping_tasks", entityId: taskId, diff: { escalated: true, reason } });
  revalidatePath("/housekeeping");
  revalidatePath(`/housekeeping/${taskId}`);
  return { ok: true };
}

/** Record several material replacements at once (default checkboxes + extras). */
export async function recordReplacements(
  taskId: string,
  items: { supply_id: string; qty: number }[],
): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const clean = (items ?? [])
    .map((i) => ({ supply_id: String(i.supply_id ?? "").trim(), qty: Number(i.qty) || 0 }))
    .filter((i) => i.supply_id && i.qty > 0);
  if (clean.length === 0) return { ok: false, error: "Tick at least one item with a quantity." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const role = attendantRole(user.roleKeys);

  for (const it of clean) {
    const { data: sup } = await admin.from("room_supplies").select("name, stock_qty").eq("id", it.supply_id).maybeSingle();
    if (!sup) continue;
    const balanceAfter = Math.max(0, Number(sup.stock_qty) - it.qty);
    await admin.from("room_supplies").update({ stock_qty: balanceAfter }).eq("id", it.supply_id);
    await logMovement(admin, { supplyId: it.supply_id, delta: -it.qty, reason: "replacement", balanceAfter, userId: user.userId, role, note: sup.name as string, refTask: taskId });
    await supabase.from("housekeeping_events").insert({
      task_id: taskId,
      event_type: "replaced",
      detail: { supply: sup.name, qty: it.qty },
      actor_role: role,
      actor_user_id: user.userId,
    });
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "room_supplies", entityId: taskId, diff: { replaced_items: clean.length, task: taskId } });
  revalidatePath(`/housekeeping/${taskId}`);
  revalidatePath("/housekeeping");
  return { ok: true };
}

/** Turn the "Mark room ready" hard stop on/off. */
export async function setHousekeepingHardStop(enabled: boolean): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "operations_manager", "hotel_rental_monitoring"])) {
    return { ok: false, error: "Only admin, operations, or hotel & rental monitoring can change this." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("feature_flags").upsert(
    { key: "housekeeping_hard_stop", label: "Housekeeping — block Mark room ready until complete", enabled, updated_by_role: firstStaffRole(user.roleKeys), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "feature_flags", entityId: "housekeeping_hard_stop", diff: { enabled } });
  revalidatePath("/housekeeping");
  return { ok: true };
}

/** Flag/unflag a supply as a standard "room material" (default checkbox). */
export async function setSupplyDefault(supplyId: string, isDefault: boolean): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "operations_manager", "hotel_rental_monitoring"])) {
    return { ok: false, error: "Only admin, operations, or hotel & rental monitoring can set default items." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("room_supplies").update({ is_default: isDefault }).eq("id", supplyId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "room_supplies", entityId: supplyId, diff: { is_default: isDefault } });
  revalidatePath("/housekeeping");
  return { ok: true };
}

export async function completeTask(
  taskId: string,
  checklist: HKChecklistItem[],
  notes: string,
): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const supabase = await createClient();
  const { data: task } = await supabase.from("housekeeping_tasks").select("unit_id").eq("id", taskId).maybeSingle();

  // Look up display label so the room card can show the cleaner's name without a join.
  const adminForLabel = createAdminClient();
  const { data: profile } = await adminForLabel.from("profiles").select("display_label").eq("id", user.userId).maybeSingle();
  const completedByName = (profile?.display_label as string) ?? null;

  const { error } = await supabase
    .from("housekeeping_tasks")
    .update({ status: "done", completed_at: new Date().toISOString(), checklist, notes: notes || null, completed_by_name: completedByName })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("housekeeping_events").insert({ task_id: taskId, event_type: "completed", detail: {}, actor_role: attendantRole(user.roleKeys), actor_user_id: user.userId });

  // Mark the room available (ready for the next occupant) via service role.
  if (task?.unit_id) {
    const admin = createAdminClient();
    await admin.from("units").update({ status: "available" }).eq("id", task.unit_id);
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "housekeeping_tasks", entityId: taskId, diff: { status: "done" } });
  revalidatePath("/housekeeping");
  revalidatePath(`/housekeeping/${taskId}`);
  revalidatePath("/hotel");
  return { ok: true };
}

// ---- per-room-type cleaning config (admin / operations / monitoring) ------
const ROOM_TYPE_ROLES = ["admin", "operations_manager", "hotel_rental_monitoring"];

/** Update a room type's timers (buffer + cleaning minutes) and checklist. */
export async function updateRoomType(
  id: string,
  fields: { buffer_minutes: number; cleaning_minutes: number; checklist: { key: string; label: string }[] },
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ROOM_TYPE_ROLES)) return { ok: false, error: "Not allowed to change cleaning timers." };
  const buffer = Math.max(0, Math.trunc(Number(fields.buffer_minutes) || 0));
  const cleaning = Math.max(1, Math.trunc(Number(fields.cleaning_minutes) || 0));
  const checklist = (fields.checklist ?? []).filter((c) => c.label?.trim()).map((c) => ({ key: c.key, label: c.label.trim() }));
  const admin = createAdminClient();
  const { error } = await admin.from("housekeeping_room_types").update({ buffer_minutes: buffer, cleaning_minutes: cleaning, checklist }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "housekeeping_room_types", entityId: id, diff: { buffer, cleaning, items: checklist.length } });
  revalidatePath("/housekeeping");
  return { ok: true };
}

/** Add a room type (business line + unit type) with default timers/checklist. */
export async function createRoomType(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ROOM_TYPE_ROLES)) return { ok: false, error: "Not allowed to add room types." };
  const business_line = String(formData.get("business_line") ?? "").trim();
  const unit_type = String(formData.get("unit_type") ?? "").trim() || null;
  const label = String(formData.get("label") ?? "").trim() || `${business_line} — ${unit_type ?? "default"}`;
  if (!["hotel", "airbnb"].includes(business_line)) return { ok: false, error: "Choose hotel or airbnb." };
  const admin = createAdminClient();
  const { error } = await admin.from("housekeeping_room_types").insert({
    business_line, unit_type, label,
    checklist: CLEANING_CHECKLIST.map((c) => ({ key: c.key, label: c.label })),
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "That room type already exists." };
    return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "housekeeping_room_types", entityId: `${business_line}/${unit_type ?? "default"}` });
  revalidatePath("/housekeeping");
  return { ok: true };
}

// ---- supplies management (admin / operations) ----------------------------
export async function adjustStock(supplyId: string, delta: number): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "operations_manager"])) return { ok: false, error: "Only admin or operations can adjust stock." };
  const supabase = await createClient();
  const { data: sup } = await supabase.from("room_supplies").select("stock_qty").eq("id", supplyId).maybeSingle();
  if (!sup) return { ok: false, error: "Supply not found." };
  const adjBalance = Math.max(0, Number(sup.stock_qty) + delta);
  const { error } = await supabase.from("room_supplies").update({ stock_qty: adjBalance }).eq("id", supplyId);
  if (error) return { ok: false, error: error.message };
  await logMovement(createAdminClient(), { supplyId, delta, reason: "adjust", balanceAfter: adjBalance, userId: user.userId, role: firstStaffRole(user.roleKeys) });
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "room_supplies", entityId: supplyId, diff: { delta } });
  revalidatePath("/housekeeping");
  return { ok: true };
}

export async function createSupply(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "operations_manager"])) return { ok: false, error: "Only admin or operations can add supplies." };
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const unit_label = String(formData.get("unit_label") ?? "pcs").trim() || "pcs";
  const stock_qty = Number(String(formData.get("stock_qty") ?? "0")) || 0;
  const reorder_level = Number(String(formData.get("reorder_level") ?? "0")) || 0;
  if (!name) return { ok: false, error: "Name is required." };
  const { error } = await supabase.from("room_supplies").insert({ name, unit_label, stock_qty, reorder_level });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "That supply already exists." };
    return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "room_supplies", entityId: name });
  revalidatePath("/housekeeping");
  return { ok: true };
}
