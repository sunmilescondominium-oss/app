"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { verifyStepUp } from "@/lib/auth/step-up";
import { COLLECTION_EDIT_ROLES } from "@/lib/rbac/modules";
import { COLLECTION_CATEGORIES, COLLECTION_CHARGE_TYPES, PAYMENT_TYPES } from "@/lib/config";
import { todayManila } from "@/lib/collections/summary";
import type { BulkResult } from "@/lib/data/bulk";

// ── Pre-fill helpers ────────────────────────────────────────────────────────

export interface ChargeSuggestion {
  key: string;
  charge_type: string;
  label: string;
  amount: number | null;
  or_number: string | null;
  /** true = checked by default in the form */
  include: boolean;
}

/**
 * Returns pre-filled charge rows for a unit/category combo. Called from the
 * client collection form as a server action (React 19 / Next.js 15 pattern).
 */
export async function getUnitCharges(
  unitId: string,
  category: string,
): Promise<ChargeSuggestion[]> {
  await requireAuth(); // gate — must be logged in
  const admin = createAdminClient();
  const out: ChargeSuggestion[] = [];

  if (category === "rental" || category === "airbnb") {
    // Active lease → rent
    const { data: lease } = await admin
      .from("leases")
      .select("rent_amount, billing_cycle")
      .eq("unit_id", unitId)
      .eq("status", "active")
      .maybeSingle();
    if (lease) {
      out.push({
        key: "rent",
        charge_type: "rent",
        label: `Monthly Rent`,
        amount: Number(lease.rent_amount),
        or_number: null,
        include: true,
      });
    }

    // Latest meter readings that have a bill_amount (one per utility type)
    const { data: meters } = await admin
      .from("meter_readings")
      .select("id, utility, bill_amount, billing_period, or_number")
      .eq("unit_id", unitId)
      .not("bill_amount", "is", null)
      .order("read_on", { ascending: false })
      .limit(6);
    const seen = new Set<string>();
    for (const m of meters ?? []) {
      const u = m.utility as string;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push({
        key: `meter-${m.id as string}`,
        charge_type: u === "electric" ? "electric" : "water",
        label: `${u === "electric" ? "Electricity (Meralco)" : "Water"}${m.billing_period ? ` — ${m.billing_period as string}` : ""}`,
        amount: Number(m.bill_amount),
        or_number: (m.or_number as string | null) ?? null,
        include: true,
      });
    }

    // Unpaid dues (unchecked by default — user opts in)
    const { data: dues } = await admin
      .from("rental_dues")
      .select("id, category, amount, due_date")
      .eq("unit_id", unitId)
      .eq("status", "unpaid")
      .order("due_date", { ascending: true })
      .limit(10);
    for (const d of dues ?? []) {
      const cat = d.category as string;
      const chargeType =
        cat === "association_dues" ? "dues"
        : cat === "electric" ? "electric"
        : cat === "water" ? "water"
        : cat === "parking" ? "parking"
        : "miscellaneous";
      out.push({
        key: `due-${d.id as string}`,
        charge_type: chargeType,
        label: `${cat.replace(/_/g, " ")} due ${d.due_date as string}`,
        amount: Number(d.amount),
        or_number: null,
        include: false,
      });
    }
  } else if (category === "hotel") {
    // Active folio: try to get the room's current rate
    const { data: room } = await admin
      .from("units")
      .select("unit_number, status")
      .eq("id", unitId)
      .maybeSingle();
    out.push({
      key: "hotel_revenue",
      charge_type: "rent",
      label: `Hotel Revenue — ${(room?.unit_number as string) ?? "room"}`,
      amount: null,
      or_number: null,
      include: true,
    });
  } else if (category === "condo_sales") {
    // Try buyer monthly amortization
    const { data: buyer } = await admin
      .from("buyers")
      .select("computation_params")
      .eq("unit_id", unitId)
      .eq("status", "current")
      .maybeSingle();
    const params = (buyer?.computation_params as Record<string, unknown> | null) ?? null;
    const amort = params?.monthly_amortization ?? params?.monthlyAmortization ?? null;
    out.push({
      key: "condo_amort",
      charge_type: "dues",
      label: "Monthly Amortization",
      amount: amort != null ? Number(amort) : null,
      or_number: null,
      include: true,
    });
  }

  // Always add a blank miscellaneous row so user can add extras
  out.push({
    key: "misc",
    charge_type: "miscellaneous",
    label: "Miscellaneous / Other",
    amount: null,
    or_number: null,
    include: false,
  });

  return out;
}

const HARD_DELETE_ROLES = ["admin", "managing_officer", "consultant", "accounting"];

/**
 * After deleting one or more collections that were part of a transmittal,
 * update the transmittal's total_amount to reflect the remaining collections.
 * If no collections remain, delete the (now empty) transmittal entirely.
 */
async function syncTransmittalTotal(
  admin: ReturnType<typeof createAdminClient>,
  transmittalId: string,
): Promise<void> {
  const { data: remaining } = await admin
    .from("collections")
    .select("amount")
    .eq("transmittal_id", transmittalId);

  if (!remaining || remaining.length === 0) {
    await admin.from("transmittals").delete().eq("id", transmittalId);
    revalidatePath("/transmittals");
  } else {
    const newTotal =
      Math.round(remaining.reduce((s, c) => s + Number(c.amount), 0) * 100) / 100;
    await admin
      .from("transmittals")
      .update({ total_amount: newTotal })
      .eq("id", transmittalId);
    revalidatePath(`/transmittals/${transmittalId}`);
    revalidatePath("/transmittals");
  }
}

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
  const affectedTransmittalIds = new Set<string>();
  for (const r of rows ?? []) {
    if (r.transmittal_id && !isConsultant) {
      skipped.push({ id: r.id as string, reason: "part of a transmittal" });
    } else {
      deletable.push(r.id as string);
      if (r.transmittal_id) affectedTransmittalIds.add(r.transmittal_id as string);
    }
  }
  let affected = 0;
  if (deletable.length) {
    const { error } = await admin.from("collections").delete().in("id", deletable);
    if (error) return { ok: false, error: error.message };
    affected = deletable.length;
    // Recalculate total for every transmittal that lost a collection.
    for (const tId of affectedTransmittalIds) {
      await syncTransmittalTotal(admin, tId);
    }
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "collections", entityId: null, diff: { bulk_delete: affected, skipped: skipped.length } });
  revalidatePath("/collections");
  return { ok: true, affected, skipped };
}

export type ActionResult = { ok: true; pendingId?: string } | { ok: false; error: string };

const CATS: readonly string[] = COLLECTION_CATEGORIES.map((c) => c.key);
const PAYS: readonly string[] = PAYMENT_TYPES.map((p) => p.key);
const CHARGES: readonly string[] = COLLECTION_CHARGE_TYPES.map((c) => c.key);
const RECEIPT_TYPES = ["OR", "AR", "PR"] as const;
const COLLECTING_ROLES = ["hotel_rental_monitoring", "accounting", "hotel_cashier"];

/**
 * Create multiple collection records from one form submission (one per charge
 * row). Called by the redesigned CollectionForm.
 */
export async function createCollectionBatch(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("collections");
  const supabase = await createClient();

  const business_line = String(formData.get("business_line") ?? "").trim();
  const unit_id = String(formData.get("unit_id") ?? "").trim() || null;
  const payment_type = String(formData.get("payment_type") ?? "cash");
  const receipt_type_raw = String(formData.get("receipt_type") ?? "").trim();
  const receipt_type = (RECEIPT_TYPES as readonly string[]).includes(receipt_type_raw)
    ? receipt_type_raw : null;
  const collected_on = String(formData.get("collected_on") ?? "").trim();
  const remarks = String(formData.get("remarks") ?? "").trim() || null;
  const check_number = String(formData.get("check_number") ?? "").trim() || null;
  const check_date = String(formData.get("check_date") ?? "").trim() || null;
  const check_bank = String(formData.get("check_bank") ?? "").trim() || null;
  const reference_no = String(formData.get("reference_no") ?? "").trim() || null;
  const payment_confirmed = payment_type === "cash" || String(formData.get("payment_confirmed") ?? "") === "on";

  let collected_by_role = String(formData.get("collected_by_role") ?? "").trim() || null;
  if (!collected_by_role)
    collected_by_role = user.roleKeys.find((r) => COLLECTING_ROLES.includes(r)) ?? "hotel_rental_monitoring";

  if (!CATS.includes(business_line)) return { ok: false, error: "Choose a category." };
  if (!PAYS.includes(payment_type)) return { ok: false, error: "Choose a payment type." };
  if (payment_type !== "cash" && !reference_no && payment_type !== "check")
    return { ok: false, error: "Enter the payment reference number." };
  if (payment_type !== "cash" && payment_type !== "check" && !payment_confirmed)
    return { ok: false, error: "Confirm you received/verified the online payment." };

  // Parse charge rows from JSON
  let rows: ChargeSuggestion[] = [];
  try {
    const raw = String(formData.get("batch_json") ?? "[]");
    rows = JSON.parse(raw) as ChargeSuggestion[];
  } catch { return { ok: false, error: "Invalid charge data." }; }

  if (rows.length === 0) return { ok: false, error: "Add at least one charge with an amount." };

  // Validate each row
  for (const r of rows) {
    if (!r.amount || !Number.isFinite(Number(r.amount)) || Number(r.amount) < 0)
      return { ok: false, error: `Invalid amount for "${r.label}".` };
  }

  // Handle proof upload (shared for the batch)
  let proof_path: string | null = null;
  const proof = formData.get("proof");
  if (payment_type !== "cash" && proof instanceof File && proof.size > 0) {
    if (proof.size > 8 * 1024 * 1024) return { ok: false, error: "Proof image too large (max 8 MB)." };
    const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${proof.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await createAdminClient().storage
      .from("payment-proofs")
      .upload(path, new Uint8Array(await proof.arrayBuffer()), { contentType: proof.type || "image/jpeg" });
    if (!up.error) proof_path = path;
  }

  const inserts = rows.map((r) => ({
    business_line,
    unit_id,
    charge_type: unit_id ? (CHARGES.includes(r.charge_type) ? r.charge_type : null) : null,
    amount: Number(r.amount),
    or_number: (r.or_number ?? "").trim() || null,
    receipt_type,
    check_number,
    check_date: check_date || null,
    check_bank,
    payment_type,
    payment_confirmed,
    reference_no,
    proof_path,
    remarks,
    collected_by_role,
    created_by: user.userId,
    ...(collected_on ? { collected_on } : {}),
  }));

  const { error } = await supabase.from("collections").insert(inserts);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "collections",
    entityId: null,
    diff: { batch: rows.length, business_line, unit_id, payment_type, receipt_type },
  });
  revalidatePath("/collections");
  return { ok: true };
}

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
  const charge_type_raw = String(formData.get("charge_type") ?? "").trim();
  const charge_type = CHARGES.includes(charge_type_raw) ? charge_type_raw : null;
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
    charge_type: unit_id ? charge_type : null,
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
  const charge_type_raw = String(formData.get("charge_type") ?? "").trim();
  const charge_type = CHARGES.includes(charge_type_raw) ? charge_type_raw : null;
  const receipt_type_raw = String(formData.get("receipt_type") ?? "").trim();
  const receipt_type = (RECEIPT_TYPES as readonly string[]).includes(receipt_type_raw) ? receipt_type_raw : null;
  const check_number = String(formData.get("check_number") ?? "").trim() || null;
  const check_date = String(formData.get("check_date") ?? "").trim() || null;
  const check_bank = String(formData.get("check_bank") ?? "").trim() || null;

  if (!CATS.includes(business_line)) return { ok: false, error: "Choose a category." };
  if (!amountRaw || !Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid amount." };
  if (!PAYS.includes(payment_type)) return { ok: false, error: "Choose a payment type." };

  const unitId = (before.unit_id as string | null) ?? null;
  const patch = {
    business_line, amount, payment_type, or_number, remarks,
    charge_type: unitId ? charge_type : null,
    receipt_type,
    check_number,
    check_date: check_date || null,
    check_bank,
    ...(collected_on ? { collected_on } : {}),
  };

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

  // Always fetch transmittal_id first — needed for total recalc after deletion.
  const { data: c } = await admin
    .from("collections")
    .select("transmittal_id")
    .eq("id", id)
    .maybeSingle();

  if (!isConsultant && c?.transmittal_id)
    return { ok: false, error: "This entry is part of a transmittal and can't be deleted." };

  const { error } = await admin.from("collections").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Keep transmittal total in sync when a linked collection is removed.
  if (c?.transmittal_id) {
    await syncTransmittalTotal(admin, c.transmittal_id as string);
  }

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
