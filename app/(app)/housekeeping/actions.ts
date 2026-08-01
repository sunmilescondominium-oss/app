"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { HKChecklistItem } from "@/lib/housekeeping/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function attendantRole(roleKeys: string[]): string {
  return roleKeys.includes("room_attendant") ? "room_attendant" : roleKeys[0] ?? "room_attendant";
}

export async function startTask(taskId: string, shift: string): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const supabase = await createClient();
  const role = attendantRole(user.roleKeys);
  const { error } = await supabase
    .from("housekeeping_tasks")
    .update({ status: "in_progress", started_at: new Date().toISOString(), assigned_to_role: role, shift: shift || null })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("housekeeping_events").insert({ task_id: taskId, event_type: "started", detail: { shift }, actor_role: role, actor_user_id: user.userId });
  revalidatePath("/housekeeping");
  revalidatePath(`/housekeeping/${taskId}`);
  return { ok: true };
}

export async function recordReplacement(
  taskId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const supabase = await createClient();
  const supply_id = String(formData.get("supply_id") ?? "").trim();
  const qty = Number(String(formData.get("qty") ?? "1")) || 0;
  if (!supply_id || qty <= 0) return { ok: false, error: "Choose a supply and quantity." };

  // Draw down stock via service role (room_attendant can't write supplies).
  const admin = createAdminClient();
  const { data: sup } = await admin.from("room_supplies").select("name, stock_qty").eq("id", supply_id).maybeSingle();
  if (!sup) return { ok: false, error: "Supply not found." };
  await admin.from("room_supplies").update({ stock_qty: Math.max(0, Number(sup.stock_qty) - qty) }).eq("id", supply_id);

  await supabase.from("housekeeping_events").insert({
    task_id: taskId,
    event_type: "replaced",
    detail: { supply: sup.name, qty },
    actor_role: attendantRole(user.roleKeys),
    actor_user_id: user.userId,
  });
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "room_supplies", entityId: supply_id, diff: { replaced: qty, task: taskId } });
  revalidatePath(`/housekeeping/${taskId}`);
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

  const { error } = await supabase
    .from("housekeeping_tasks")
    .update({ status: "done", completed_at: new Date().toISOString(), checklist, notes: notes || null })
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

export async function turnoverTask(
  taskId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("housekeeping");
  const supabase = await createClient();
  const note = String(formData.get("note") ?? "").trim();
  const to_shift = String(formData.get("to_shift") ?? "").trim() || null;

  const { error } = await supabase.from("housekeeping_events").insert({
    task_id: taskId,
    event_type: "turned_over",
    detail: { note, to_shift },
    actor_role: attendantRole(user.roleKeys),
    actor_user_id: user.userId,
  });
  if (error) return { ok: false, error: error.message };
  if (to_shift) await supabase.from("housekeeping_tasks").update({ shift: to_shift }).eq("id", taskId);

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "housekeeping_tasks", entityId: taskId, diff: { turnover: true, to_shift } });
  revalidatePath(`/housekeeping/${taskId}`);
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
  const { error } = await supabase.from("room_supplies").update({ stock_qty: Math.max(0, Number(sup.stock_qty) + delta) }).eq("id", supplyId);
  if (error) return { ok: false, error: error.message };
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
