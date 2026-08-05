"use server";

import { revalidatePath } from "next/cache";
import { requireModule, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import {
  ENDORSE_ROLES, BUDGET_ROLES, OWNER_ROLES, PURCHASE_ROLES, RECEIVE_ROLES,
  getOwnerThreshold,
} from "@/lib/requisitions/queries";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const HARD_DELETE_ROLES = ["admin", "managing_officer", "consultant"];

/** Bulk cancel requisitions (soft). */
export async function bulkCancelRequisitions(ids: string[]): Promise<import("@/lib/data/bulk").BulkResult> {
  const actor = await requireModuleWrite("requisitions");
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  const admin = createAdminClient();
  const { error } = await admin.from("requisitions").update({ status: "cancelled" }).in("id", list).neq("status", "received");
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "requisitions", entityId: null, diff: { bulk_cancel: list.length } });
  revalidatePath("/requisitions");
  return { ok: true, affected: list.length, skipped: [] };
}

/** Bulk PERMANENT delete requisitions (cascades line items). */
export async function bulkDeleteRequisitions(ids: string[]): Promise<import("@/lib/data/bulk").BulkResult> {
  const actor = await requireModule("requisitions");
  if (!userHasAnyRole(actor, HARD_DELETE_ROLES)) return { ok: false, error: "Only an admin or managing officer can permanently delete." };
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  const admin = createAdminClient();
  let affected = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const id of list) {
    const { error } = await admin.from("requisitions").delete().eq("id", id);
    if (error) skipped.push({ id, reason: /foreign key|violates/i.test(error.message) ? "referenced by other records (cancel instead)" : error.message });
    else affected += 1;
  }
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "delete", entity: "requisitions", entityId: null, diff: { hard_delete: true, deleted: affected, skipped: skipped.length } });
  revalidatePath("/requisitions");
  return { ok: true, affected, skipped };
}

type LineInput = {
  itemId: string | null; itemName: string; category: string; unitLabel: string;
  qty: number; estUnitCost: number; target: "room_supplies" | "materials";
};

function actingRole(userRoles: string[], allowed: string[]): string {
  return userRoles.find((r) => allowed.includes(r)) ?? userRoles[0] ?? "unknown";
}

/** Staff files a new requisition with one or more line items. */
export async function createRequisition(input: {
  title: string; businessLine: string; purpose: string; neededBy: string; note: string;
  items: LineInput[];
}): Promise<ActionResult> {
  const actor = await requireModuleWrite("requisitions");
  const title = input.title.trim();
  if (!title) return { ok: false, error: "A title is required." };
  const items = input.items.filter((i) => i.itemName.trim() && i.qty > 0);
  if (items.length === 0) return { ok: false, error: "Add at least one item." };

  const estTotal = items.reduce((s, i) => s + i.qty * i.estUnitCost, 0);
  const admin = createAdminClient();
  const refNo = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const { data, error } = await admin.from("requisitions").insert({
    ref_no: refNo, title, business_line: input.businessLine.trim() || null,
    purpose: input.purpose.trim() || null, needed_by: input.neededBy || null,
    note: input.note.trim() || null, est_total: estTotal, status: "submitted",
    requested_by_role: actingRole(actor.roleKeys, actor.roleKeys), requested_by_user: actor.userId,
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save." };

  const rows = items.map((i) => ({
    requisition_id: data.id, item_id: i.itemId, item_name: i.itemName.trim(),
    category: i.category, unit_label: i.unitLabel.trim() || "pc", qty: i.qty,
    est_unit_cost: i.estUnitCost, target: i.target,
  }));
  const { error: itemErr } = await admin.from("requisition_items").insert(rows);
  if (itemErr) return { ok: false, error: itemErr.message };

  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "create", entity: "requisitions", entityId: data.id, diff: { refNo, estTotal } });
  revalidatePath("/requisitions");
  return { ok: true, id: data.id };
}

async function advance(
  id: string, allowed: string[], patch: Record<string, unknown>, action: string,
): Promise<ActionResult> {
  const actor = await requireModule("requisitions");
  if (!userHasAnyRole(actor, allowed)) return { ok: false, error: "Your role can't take this step." };
  const admin = createAdminClient();
  const { error } = await admin.from("requisitions").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "requisitions", entityId: id, diff: { step: action } });
  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
  return { ok: true, id };
}

/** Operations endorses a submitted requisition. */
export async function endorseRequisition(id: string): Promise<ActionResult> {
  const actor = await requireModule("requisitions");
  const role = actingRole(actor.roleKeys, ENDORSE_ROLES);
  return advance(id, ENDORSE_ROLES, { status: "budget_review", endorsed_by_role: role, endorsed_at: new Date().toISOString() }, "endorse");
}

/** Accounting reviews budget — routes to owner if over the threshold, else approves. */
export async function budgetReviewRequisition(id: string): Promise<ActionResult> {
  const actor = await requireModule("requisitions");
  if (!userHasAnyRole(actor, BUDGET_ROLES)) return { ok: false, error: "Your role can't take this step." };
  const admin = createAdminClient();
  const { data } = await admin.from("requisitions").select("est_total").eq("id", id).maybeSingle();
  const threshold = await getOwnerThreshold();
  const role = actingRole(actor.roleKeys, BUDGET_ROLES);
  const overThreshold = Number(data?.est_total ?? 0) >= threshold;
  const next = overThreshold ? "owner_review" : "approved";
  return advance(id, BUDGET_ROLES, { status: next, budget_by_role: role, budget_at: new Date().toISOString() }, "budget_review");
}

/** Owner gives final approval for a high-value requisition. */
export async function ownerApproveRequisition(id: string): Promise<ActionResult> {
  const actor = await requireModule("requisitions");
  const role = actingRole(actor.roleKeys, OWNER_ROLES);
  return advance(id, OWNER_ROLES, { status: "approved", owner_by_role: role, owner_at: new Date().toISOString() }, "owner_approve");
}

/** Any approver in the chain can reject with a reason. */
export async function rejectRequisition(id: string, reason: string): Promise<ActionResult> {
  const actor = await requireModule("requisitions");
  const allowed = [...ENDORSE_ROLES, ...BUDGET_ROLES, ...OWNER_ROLES];
  if (!userHasAnyRole(actor, allowed)) return { ok: false, error: "Your role can't reject this." };
  return advance(id, allowed, { status: "rejected", reject_reason: reason.trim() || "No reason given." }, "reject");
}

/** Purchasing records the supplier and actual cost. */
export async function markPurchased(id: string, supplier: string, actualTotal: number): Promise<ActionResult> {
  const actor = await requireModule("requisitions");
  const role = actingRole(actor.roleKeys, PURCHASE_ROLES);
  return advance(id, PURCHASE_ROLES, {
    status: "purchased", supplier: supplier.trim() || null,
    actual_total: Number.isFinite(actualTotal) ? actualTotal : null,
    purchased_by_role: role, purchased_at: new Date().toISOString(),
  }, "purchase");
}

/** Receiving marks goods received and tops up stock (room supplies + materials). */
export async function receiveRequisition(id: string): Promise<ActionResult> {
  const actor = await requireModule("requisitions");
  if (!userHasAnyRole(actor, RECEIVE_ROLES)) return { ok: false, error: "Your role can't receive goods." };
  const admin = createAdminClient();
  const { data: items } = await admin.from("requisition_items").select("*").eq("requisition_id", id);

  for (const i of items ?? []) {
    const qty = Number(i.qty);
    if (i.target === "materials") {
      if (i.item_id) {
        const { data: cur } = await admin.from("material_items").select("stock_qty").eq("id", i.item_id).maybeSingle();
        await admin.from("material_items").update({ stock_qty: Number(cur?.stock_qty ?? 0) + qty }).eq("id", i.item_id);
      } else {
        // Free-text material → create/keep a catalog entry so stock is tracked.
        const { data: existing } = await admin.from("material_items").select("id, stock_qty").ilike("name", i.item_name).maybeSingle();
        if (existing) {
          await admin.from("material_items").update({ stock_qty: Number(existing.stock_qty) + qty }).eq("id", existing.id);
        } else {
          await admin.from("material_items").insert({ name: i.item_name, category: i.category, unit_label: i.unit_label, stock_qty: qty, target: "materials" });
        }
      }
    } else {
      // room_supplies keyed by unique name — upsert then increment.
      const { data: sup } = await admin.from("room_supplies").select("id, stock_qty").ilike("name", i.item_name).maybeSingle();
      if (sup) {
        await admin.from("room_supplies").update({ stock_qty: Number(sup.stock_qty) + qty }).eq("id", sup.id);
      } else {
        await admin.from("room_supplies").insert({ name: i.item_name, unit_label: i.unit_label, stock_qty: qty });
      }
    }
    await admin.from("requisition_items").update({ received_qty: qty }).eq("id", i.id);
  }

  const role = actingRole(actor.roleKeys, RECEIVE_ROLES);
  return advance(id, RECEIVE_ROLES, { status: "received", received_by_role: role, received_at: new Date().toISOString() }, "receive");
}

/** Accounting/admin sets the owner-approval threshold. */
export async function setOwnerThreshold(amount: number): Promise<ActionResult> {
  const actor = await requireModule("requisitions");
  if (!userHasAnyRole(actor, [...BUDGET_ROLES, ...OWNER_ROLES])) return { ok: false, error: "Not allowed." };
  const admin = createAdminClient();
  const { error } = await admin.from("requisition_settings").update({ owner_threshold: amount, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/requisitions");
  return { ok: true };
}
