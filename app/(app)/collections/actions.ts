"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { verifyStepUp } from "@/lib/auth/step-up";
import { COLLECTION_EDIT_ROLES } from "@/lib/rbac/modules";
import { COLLECTION_CATEGORIES, PAYMENT_TYPES } from "@/lib/config";
import type { BulkResult } from "@/lib/data/bulk";

const HARD_DELETE_ROLES = ["admin", "managing_officer", "consultant", "accounting"];

/** Bulk delete collections. Entries already in a transmittal are skipped (consultant can override). */
export async function bulkDeleteCollections(ids: string[]): Promise<BulkResult> {
  const user = await requireModuleWrite("collections");
  if (!userHasAnyRole(user, HARD_DELETE_ROLES)) return { ok: false, error: "Only accounting / admin can bulk-delete collections." };
  const isConsultant = user.roleKeys.includes("consultant");
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  const admin = createAdminClient();
  const { data: rows } = await admin.from("collections").select("id, transmittal_id").in("id", list);
  const skipped: { id: string; reason: string }[] = [];
  const deletable: string[] = [];
  for (const r of rows ?? []) {
    if (r.transmittal_id && !isConsultant) skipped.push({ id: r.id as string, reason: "part of a transmittal" });
    else deletable.push(r.id as string);
  }
  let affected = 0;
  if (deletable.length) {
    const { error } = await admin.from("collections").delete().in("id", deletable);
    if (error) return { ok: false, error: error.message };
    affected = deletable.length;
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "collections", entityId: null, diff: { bulk_delete: affected, skipped: skipped.length } });
  revalidatePath("/collections");
  return { ok: true, affected, skipped };
}

export type ActionResult = { ok: true; pendingId?: string } | { ok: false; error: string };

const CATS: readonly string[] = COLLECTION_CATEGORIES.map((c) => c.key);
const PAYS: readonly string[] = PAYMENT_TYPES.map((p) => p.key);
const COLLECTING_ROLES = ["hotel_rental_monitoring", "accounting", "hotel_cashier"];

export async function createCollection(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("collections");
  const supabase = await createClient();

  const business_line = String(formData.get("business_line") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = Number(amountRaw);
  const payment_type = String(formData.get("payment_type") ?? "cash");
  const or_number = String(formData.get("or_number") ?? "").trim() || null;
  const unit_id = String(formData.get("unit_id") ?? "").trim() || null;
  const collected_on = String(formData.get("collected_on") ?? "").trim();
  const remarks = String(formData.get("remarks") ?? "").trim() || null;
  const reference_no = String(formData.get("reference_no") ?? "").trim() || null;
  const coupon_code = String(formData.get("coupon_code") ?? "").trim() || null;
  const discount_amount = Number(String(formData.get("discount_amount") ?? "0")) || 0;
  let collected_by_role = String(formData.get("collected_by_role") ?? "").trim() || null;

  if (!CATS.includes(business_line)) return { ok: false, error: "Choose a category." };
  if (!amountRaw || !Number.isFinite(amount) || amount < 0)
    return { ok: false, error: "Enter a valid amount." };
  if (!PAYS.includes(payment_type)) return { ok: false, error: "Choose a payment type." };
  if (discount_amount < 0) return { ok: false, error: "Discount cannot be negative." };

  const isCash = payment_type === "cash";
  // Online payments should be backed by proof + a confirmation of receipt.
  if (!isCash && !reference_no) return { ok: false, error: "Enter the payment reference number." };
  const payment_confirmed = isCash || String(formData.get("payment_confirmed") ?? "") === "on";
  if (!isCash && !payment_confirmed) return { ok: false, error: "Confirm you received/verified the online payment." };

  let proof_path: string | null = null;
  const proof = formData.get("proof");
  if (!isCash && proof instanceof File && proof.size > 0) {
    if (proof.size > 8 * 1024 * 1024) return { ok: false, error: "Proof image too large (max 8 MB)." };
    const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${proof.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await createAdminClient().storage.from("payment-proofs").upload(path, new Uint8Array(await proof.arrayBuffer()), { contentType: proof.type || "image/jpeg" });
    if (!up.error) proof_path = path;
  }

  if (!collected_by_role)
    collected_by_role =
      user.roleKeys.find((r) => COLLECTING_ROLES.includes(r)) ?? "hotel_rental_monitoring";

  const insert: Record<string, unknown> = {
    business_line,
    amount,
    payment_type,
    or_number,
    unit_id,
    remarks,
    reference_no,
    proof_path,
    payment_confirmed,
    discount_amount,
    coupon_code,
    collected_by_role,
    created_by: user.userId,
  };
  if (collected_on) insert.collected_on = collected_on;

  const { data, error } = await supabase
    .from("collections")
    .insert(insert)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "collections",
    entityId: data.id as string,
    diff: { business_line, amount, or_number, payment_type },
  });
  revalidatePath("/collections");
  return { ok: true };
}

/**
 * Edit a collection entry.
 *
 * - If the collection is NOT in a transmittal (transmittal_id is null):
 *   applies the change directly and logs an audit entry. No approval needed
 *   because the collection is already free (e.g. after a revert).
 *
 * - If the collection IS locked in a live transmittal: creates a pending
 *   authorization request that a managing officer / consultant must approve.
 *   The step-up credentials (justification, employee code, passcode,
 *   CONFIRM EDIT) are required in that case.
 */
export async function editCollection(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...COLLECTION_EDIT_ROLES])) {
    return { ok: false, error: "You don't have the authority to edit a collection." };
  }

  const admin = createAdminClient();
  const { data: before, error: loadErr } = await admin.from("collections").select("*").eq("id", id).maybeSingle();
  if (loadErr || !before) return { ok: false, error: "Collection entry not found." };

  const business_line = String(formData.get("business_line") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = Number(amountRaw);
  const payment_type = String(formData.get("payment_type") ?? "").trim();
  const or_number = String(formData.get("or_number") ?? "").trim() || null;
  const collected_on = String(formData.get("collected_on") ?? "").trim();
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  if (!CATS.includes(business_line)) return { ok: false, error: "Choose a category." };
  if (!amountRaw || !Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid amount." };
  if (!PAYS.includes(payment_type)) return { ok: false, error: "Choose a payment type." };

  const patch = { business_line, amount, payment_type, or_number, remarks, ...(collected_on ? { collected_on } : {}) };

  // --- Free collection (not in a transmittal): apply directly ---
  if (!before.transmittal_id) {
    const { error: updErr } = await admin.from("collections").update(patch).eq("id", id);
    if (updErr) return { ok: false, error: updErr.message };

    await admin.from("collection_edits").insert({
      collection_id: id,
      edited_by: user.userId,
      editor_role: user.roleKeys[0] ?? null,
      justification: "(direct edit — collection was not in a transmittal)",
      before_json: before,
      after_json: { ...before, ...patch },
    });

    await logAudit({
      actorUserId: user.userId,
      actorRoles: user.roleKeys,
      action: "update",
      entity: "collections",
      entityId: id,
      diff: { direct_edit: true, from: { amount: before.amount, or_number: before.or_number, payment_type: before.payment_type, business_line: before.business_line }, to: patch },
    });
    revalidatePath("/collections");
    return { ok: true };
  }

  // --- Transmitted collection: authorization gate ---
  const gate = await verifyStepUp(user.userId, formData);
  if (!gate.ok) return gate;

  const requesterRole = user.roleKeys.find((r) => COLLECTION_EDIT_ROLES.includes(r)) ?? user.roleKeys[0] ?? null;

  const { data: req, error: reqErr } = await admin.from("authorization_requests").insert({
    type: "collection_edit",
    entity_id: id,
    requested_by: user.userId,
    requester_role: requesterRole,
    justification: gate.justification,
    payload: { before, patch, collection_id: id, was_transmitted: true },
  }).select("id").single();
  if (reqErr) return { ok: false, error: reqErr.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "authorization_requests",
    entityId: req.id as string,
    diff: { type: "collection_edit", collection_id: id, justification: gate.justification, was_transmitted: true },
  });
  return { ok: true, pendingId: req.id as string };
}

export async function deleteCollection(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("collections");
  const isConsultant = user.roleKeys.includes("consultant");
  const admin = createAdminClient();

  if (!isConsultant) {
    const { data: c } = await admin
      .from("collections")
      .select("transmittal_id")
      .eq("id", id)
      .maybeSingle();
    if (c?.transmittal_id)
      return { ok: false, error: "This entry is part of a transmittal and can't be deleted." };
  }

  const { error } = await admin.from("collections").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "delete",
    entity: "collections",
    entityId: id,
  });
  revalidatePath("/collections");
  return { ok: true };
}
