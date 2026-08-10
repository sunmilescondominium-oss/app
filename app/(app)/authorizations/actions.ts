"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { COLLECTION_CATEGORIES, PAYMENT_TYPES } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };

const APPROVER_ROLES = ["admin", "managing_officer", "consultant"];
const CATS: readonly string[] = COLLECTION_CATEGORIES.map((c) => c.key);
const PAYS: readonly string[] = PAYMENT_TYPES.map((p) => p.key);

export async function approveRequest(
  requestId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, APPROVER_ROLES)) {
    return { ok: false, error: "Only managing officers, consultants, or admin can approve requests." };
  }

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("authorization_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "pending") return { ok: false, error: `This request is already ${req.status}.` };
  if (new Date(req.expires_at as string) < new Date()) {
    await admin.from("authorization_requests").update({ status: "expired" }).eq("id", requestId);
    return { ok: false, error: "This request has expired." };
  }

  const reviewerRole = user.roleKeys.find((r) => APPROVER_ROLES.includes(r)) ?? user.roleKeys[0] ?? null;
  const review_note = String(formData.get("review_note") ?? "").trim() || null;

  if (req.type === "collection_edit") {
    const result = await executeCollectionEdit(req as Record<string, unknown>, user.userId, reviewerRole);
    if (!result.ok) return result;
  } else if (req.type === "transmittal_revert") {
    const result = await executeTransmittalRevert(req as Record<string, unknown>, user.userId, reviewerRole);
    if (!result.ok) return result;
  }

  await admin.from("authorization_requests").update({
    status: "approved",
    reviewed_by: user.userId,
    reviewer_role: reviewerRole,
    reviewed_at: new Date().toISOString(),
    review_note,
  }).eq("id", requestId);

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "authorization_requests",
    entityId: requestId,
    diff: { decision: "approved", review_note, type: req.type, entity_id: req.entity_id },
  });

  revalidatePath("/dashboard");
  revalidatePath("/collections");
  revalidatePath("/transmittals");
  return { ok: true };
}

export async function rejectRequest(
  requestId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, APPROVER_ROLES)) {
    return { ok: false, error: "Only managing officers, consultants, or admin can reject requests." };
  }

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("authorization_requests")
    .select("id, status, type, entity_id")
    .eq("id", requestId)
    .maybeSingle();

  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "pending") return { ok: false, error: `This request is already ${req.status}.` };

  const reviewerRole = user.roleKeys.find((r) => APPROVER_ROLES.includes(r)) ?? user.roleKeys[0] ?? null;
  const review_note = String(formData.get("review_note") ?? "").trim() || null;

  await admin.from("authorization_requests").update({
    status: "rejected",
    reviewed_by: user.userId,
    reviewer_role: reviewerRole,
    reviewed_at: new Date().toISOString(),
    review_note,
  }).eq("id", requestId);

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "authorization_requests",
    entityId: requestId,
    diff: { decision: "rejected", review_note, type: req.type, entity_id: req.entity_id },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Execution helpers — called only from approveRequest
// ---------------------------------------------------------------------------

async function executeCollectionEdit(
  req: Record<string, unknown>,
  reviewerUserId: string,
  reviewerRole: string | null,
): Promise<ActionResult> {
  const admin = createAdminClient();
  const payload = req.payload as Record<string, unknown>;
  const before = payload.before as Record<string, unknown>;
  const patch = payload.patch as Record<string, unknown>;
  const collectionId = String(payload.collection_id ?? req.entity_id);

  if (!CATS.includes(String(patch.business_line))) return { ok: false, error: "Invalid category in request." };
  const amount = Number(patch.amount);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Invalid amount in request." };
  if (!PAYS.includes(String(patch.payment_type))) return { ok: false, error: "Invalid payment type in request." };

  const { data: after, error: updErr } = await admin
    .from("collections")
    .update(patch)
    .eq("id", collectionId)
    .select("*")
    .single();
  if (updErr) return { ok: false, error: updErr.message };

  await admin.from("collection_edits").insert({
    collection_id: collectionId,
    edited_by: req.requested_by as string,
    editor_role: req.requester_role as string,
    justification: req.justification as string,
    before_json: before,
    after_json: after,
  });

  await logAudit({
    actorUserId: reviewerUserId,
    actorRoles: [reviewerRole ?? "admin"],
    action: "update",
    entity: "collections",
    entityId: collectionId,
    diff: {
      approved_edit: true,
      requested_by: req.requested_by,
      justification: req.justification,
      from: { amount: before.amount, or_number: before.or_number, payment_type: before.payment_type, business_line: before.business_line },
      to: { amount: patch.amount, or_number: patch.or_number, payment_type: patch.payment_type, business_line: patch.business_line },
      was_transmitted: payload.was_transmitted,
    },
  });
  return { ok: true };
}

async function executeTransmittalRevert(
  req: Record<string, unknown>,
  reviewerUserId: string,
  reviewerRole: string | null,
): Promise<ActionResult> {
  const admin = createAdminClient();
  const payload = req.payload as Record<string, unknown>;
  const transmittalId = String(payload.transmittal_id ?? req.entity_id);
  const shortRef = String(payload.transmittal_ref ?? transmittalId.slice(0, 8).toUpperCase());

  const { data: t } = await admin.from("transmittals").select("id, status, total_amount").eq("id", transmittalId).maybeSingle();
  if (!t) return { ok: false, error: "Transmittal no longer exists — it may have already been reverted." };
  if (t.status === "reconciled") return { ok: false, error: "Transmittal has since been reconciled and can no longer be reverted." };

  // Void linked bank transaction if deposited.
  let bankVoided = false;
  if (t.status === "deposited") {
    const { data: btRows } = await admin.from("bank_transactions").select("id").eq("transmittal_id", transmittalId);
    if (btRows && btRows.length > 0) {
      await admin.from("bank_transactions")
        .update({ status: "void", memo: `Voided — transmittal ${shortRef} reverted` })
        .eq("transmittal_id", transmittalId);
      bankVoided = true;
    }
  }

  // Free collections and stamp revert-tracing columns.
  const { data: freed } = await admin
    .from("collections")
    .update({ transmittal_id: null, last_reverted_from_ref: shortRef })
    .eq("transmittal_id", transmittalId)
    .select("id, reverted_count");

  // Increment reverted_count individually (Supabase doesn't support col+1 in update).
  if (freed && freed.length > 0) {
    for (const row of freed) {
      await admin.from("collections")
        .update({ reverted_count: ((row.reverted_count as number) ?? 0) + 1, last_reverted_from_ref: shortRef })
        .eq("id", row.id as string);
    }
  }
  const freedCount = freed?.length ?? 0;

  // Delete custody trail + transmittal.
  await admin.from("transmittal_custody").delete().eq("transmittal_id", transmittalId);
  const { error: delErr } = await admin.from("transmittals").delete().eq("id", transmittalId);
  if (delErr) return { ok: false, error: delErr.message };

  await logAudit({
    actorUserId: reviewerUserId,
    actorRoles: [reviewerRole ?? "admin"],
    action: "delete",
    entity: "transmittals",
    entityId: transmittalId,
    diff: {
      approved_revert: true,
      requested_by: req.requested_by,
      justification: req.justification,
      status_was: payload.status_was,
      total_amount: payload.total_amount,
      collections_freed: freedCount,
      bank_transaction_voided: bankVoided,
    },
  });
  return { ok: true };
}
