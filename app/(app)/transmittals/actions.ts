"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuth,
  requireModuleWrite,
  userHasAnyRole,
} from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { todayManila } from "@/lib/collections/summary";
import { verifyStepUp } from "@/lib/auth/step-up";
import { COLLECTION_EDIT_ROLES } from "@/lib/rbac/modules";
import { createNotification } from "@/lib/notifications/queries";

function nextBusinessDay(fromIso: string): string {
  const d = new Date(fromIso + "T00:00:00+08:00");
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().slice(0, 10);
}

export type ActionResult = { ok: true; pendingId?: string } | { ok: false; error: string };

/**
 * Revert a transmittal back to loose collections (error in payment application).
 * Un-links every collection from the transmittal so they become editable again
 * and deletes the transmittal. Gated exactly like a collection edit: authority
 * role + justification + "CONFIRM EDIT" + employee-code/passcode re-auth. Only
 * allowed before the money is deposited (draft/submitted) to avoid breaking
 * banking records; deposited/reconciled transmittals are blocked.
 */
export async function revertTransmittal(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...COLLECTION_EDIT_ROLES])) {
    return { ok: false, error: "You don't have the authority to revert a transmittal." };
  }

  const admin = createAdminClient();
  const { data: t } = await admin.from("transmittals").select("id, status, total_amount, transmittal_date").eq("id", id).maybeSingle();
  if (!t) return { ok: false, error: "Transmittal not found." };
  if (t.status === "reconciled") {
    return { ok: false, error: "This transmittal is already reconciled — the books are closed. Coordinate any correction with accounting." };
  }

  const gate = await verifyStepUp(user.userId, formData);
  if (!gate.ok) return gate;

  // Count how many collections would be freed so the approver can see the impact.
  const { data: colRows } = await admin.from("collections").select("id").eq("transmittal_id", id);
  const collectionCount = colRows?.length ?? 0;

  const requesterRole = user.roleKeys.find((r) => [...COLLECTION_EDIT_ROLES].includes(r)) ?? user.roleKeys[0] ?? null;

  const { data: req, error: reqErr } = await admin.from("authorization_requests").insert({
    type: "transmittal_revert",
    entity_id: id,
    requested_by: user.userId,
    requester_role: requesterRole,
    justification: gate.justification,
    payload: {
      transmittal_id: id,
      transmittal_ref: id.slice(0, 8).toUpperCase(),
      transmittal_date: t.transmittal_date,
      status_was: t.status,
      total_amount: t.total_amount,
      collection_count: collectionCount,
    },
  }).select("id").single();
  if (reqErr) return { ok: false, error: reqErr.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "authorization_requests",
    entityId: req.id as string,
    diff: { type: "transmittal_revert", transmittal_id: id, justification: gate.justification, status_was: t.status },
  });
  return { ok: true, pendingId: req.id as string };
}

function firstHeld(roleKeys: string[], preferred: string[]): string {
  return preferred.find((r) => roleKeys.includes(r)) ?? preferred[0];
}

export type CollectionOption = {
  id: string;
  or_number: string | null;
  amount: number;
  business_line: string;
  payment_type: string;
  collected_on: string;
};

export type FetchCollectionsResult =
  | { ok: true; collections: CollectionOption[] }
  | { ok: false; error: string };

/**
 * Return ALL un-transmitted collections across all dates.
 * Collections from previous days that haven't been turned over yet are
 * included so they can be bundled into today's (or any) transmittal.
 */
export async function fetchUntransmittedCollections(): Promise<FetchCollectionsResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["hotel_rental_monitoring", "accounting", "hotel_cashier", "consultant"]))
    return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("collections")
    .select("id, or_number, amount, business_line, payment_type, collected_on")
    .is("transmittal_id", null)
    .order("collected_on", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    collections: (data ?? []).map((c) => ({
      id: c.id as string,
      or_number: c.or_number as string | null,
      amount: Number(c.amount),
      business_line: c.business_line as string,
      payment_type: c.payment_type as string,
      collected_on: c.collected_on as string,
    })),
  };
}

/** Bundle selected un-transmitted collections into a new transmittal. */
export async function buildTransmittalForDate(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["hotel_rental_monitoring", "accounting", "hotel_cashier"]))
    return { ok: false, error: "Only the cashier, monitoring, or accounting can build a transmittal." };

  const supabase = createAdminClient();
  const date = String(formData.get("date") ?? "").trim();
  if (!date) return { ok: false, error: "Choose a date." };

  const payment_mode = (String(formData.get("payment_mode") ?? "cash").trim() || "cash") as "cash" | "bank_transfer";
  const transmittal_source = String(formData.get("transmittal_source") ?? "").trim() || null;

  // Parse selected collection IDs.
  let selectedIds: string[] = [];
  const idsRaw = String(formData.get("collection_ids") ?? "").trim();
  if (idsRaw) {
    try {
      const parsed = JSON.parse(idsRaw);
      if (Array.isArray(parsed)) selectedIds = (parsed as unknown[]).filter((x): x is string => typeof x === "string");
    } catch { /* ignore */ }
  }
  if (selectedIds.length === 0)
    return { ok: false, error: "Select at least one collection to bundle." };

  // Fetch only the selected un-transmitted collections.
  const { data: cols, error: cErr } = await supabase
    .from("collections")
    .select("id, amount")
    .in("id", selectedIds)
    .is("transmittal_id", null);
  if (cErr) return { ok: false, error: cErr.message };
  if (!cols || cols.length === 0)
    return { ok: false, error: "None of the selected collections are available (already transmitted or not found)." };

  const total = cols.reduce((s, c) => s + Number(c.amount), 0);
  const counted_by_role = firstHeld(user.roleKeys, ["hotel_cashier", "hotel_rental_monitoring", "accounting"]);

  // Cash denomination count.
  let denomination_counts: Record<string, number> | null = null;
  let counted_cash: number | null = null;
  if (payment_mode === "cash") {
    const denomRaw = String(formData.get("denomination_counts") ?? "").trim();
    if (denomRaw) {
      try {
        const parsed = JSON.parse(denomRaw) as Record<string, number>;
        denomination_counts = parsed;
        counted_cash = Object.entries(parsed).reduce((s, [v, n]) => {
          const numVal = Number(v.split("-").pop());
          return s + (isNaN(numVal) ? 0 : numVal) * (Number(n) || 0);
        }, 0);
        counted_cash = Math.round(counted_cash * 100) / 100;
      } catch { /* ignore malformed count */ }
    }
  }

  // Bank transfer proof + bank account.
  let transfer_proof_path: string | null = null;
  let transfer_bank_account_id: string | null = null;
  if (payment_mode === "bank_transfer") {
    transfer_bank_account_id = String(formData.get("bank_account_id") ?? "").trim() || null;
    if (!transfer_bank_account_id)
      return { ok: false, error: "Choose the Sun Miles bank account the payment was deposited to." };

    const proof = formData.get("transfer_proof");
    if (proof instanceof File && proof.size > 0) {
      if (proof.size > 8 * 1024 * 1024) return { ok: false, error: "Proof image too large (max 8 MB)." };
      const path = `transmittal-proofs/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${proof.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const up = await supabase.storage
        .from("payment-proofs")
        .upload(path, new Uint8Array(await proof.arrayBuffer()), { contentType: proof.type || "image/jpeg" });
      if (!up.error) transfer_proof_path = path;
    }
  }

  const { data: t, error: tErr } = await supabase
    .from("transmittals")
    .insert({
      transmittal_date: date,
      total_amount: total,
      counted_by_role,
      denomination_counts,
      counted_cash,
      payment_mode,
      transmittal_source,
      transfer_proof_path,
      transfer_bank_account_id,
      status: "submitted",
      created_by: user.userId,
    })
    .select("id")
    .single();
  if (tErr) return { ok: false, error: tErr.message };

  const { error: uErr } = await supabase
    .from("collections")
    .update({ transmittal_id: t.id as string })
    .in("id", cols.map((c) => c.id));
  if (uErr) return { ok: false, error: uErr.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "transmittals",
    entityId: t.id as string,
    diff: { date, total, count: cols.length, payment_mode, transmittal_source },
  });

  // Notify accounting that a transmittal is ready for review.
  void createNotification({
    kind: "transmittal_built",
    title: `Transmittal built — ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
    body: `${cols.length} collection(s) for ${date}, ${payment_mode.replace("_", " ")}.`,
    link: `/transmittals/${t.id as string}`,
    entityType: "transmittal",
    entityId: t.id as string,
    recipientRole: "accounting",
    createdBy: user.userId,
  });

  revalidatePath("/transmittals");
  return { ok: true };
}

/**
 * Consultant/admin: recalculate transmittal.total_amount from its current
 * linked collections and persist it. Fixes the list-page figure when a
 * collection was deleted after the transmittal was built.
 */
export async function fixTransmittalTotal(id: string): Promise<void> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["consultant", "admin", "managing_officer"])) return;

  const admin = createAdminClient();
  const { data: cols } = await admin
    .from("collections")
    .select("amount")
    .eq("transmittal_id", id);

  if (!cols || cols.length === 0) {
    await admin.from("transmittals").delete().eq("id", id);
    await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "transmittals", entityId: id, diff: { reason: "no remaining collections" } });
    revalidatePath("/transmittals");
    return;
  }

  const newTotal = Math.round(cols.reduce((s, c) => s + Number(c.amount), 0) * 100) / 100;
  await admin.from("transmittals").update({ total_amount: newTotal }).eq("id", id);
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "transmittals", entityId: id, diff: { total_amount: newTotal, reason: "manual sync" } });
  revalidatePath(`/transmittals/${id}`);
  revalidatePath("/transmittals");
}

/** Monitoring/admin sets the AR receipt series (prefix + next number). */
export async function setReceiptSeries(context: "hotel" | "rental" | "parking", prefix: string, nextNo: number): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "hotel_rental_monitoring"]))
    return { ok: false, error: "Only monitoring/admin can set the receipt series." };
  if (!["hotel", "rental", "parking"].includes(context)) return { ok: false, error: "Invalid context." };
  if (!Number.isInteger(nextNo) || nextNo < 1) return { ok: false, error: "Next number must be a positive integer." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("receipt_series")
    .update({ prefix: prefix.trim(), next_no: nextNo, updated_by: user.userId, updated_at: new Date().toISOString() })
    .eq("context", context);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "receipt_series", entityId: context, diff: { prefix, nextNo } });
  revalidatePath("/transmittals");
  return { ok: true };
}

/** errand_liaison (or accounting/managing) confirms the bank deposit. */
export async function depositTransmittal(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("transmittals");
  const supabase = await createClient();
  const deposit_slip_ref = String(formData.get("deposit_slip_ref") ?? "").trim();
  if (!deposit_slip_ref) return { ok: false, error: "Enter the deposit slip reference." };
  const depositedRaw = String(formData.get("deposited_amount") ?? "").trim();
  const deposited_amount = depositedRaw ? Number(depositedRaw) : null;
  if (deposited_amount != null && (!Number.isFinite(deposited_amount) || deposited_amount < 0))
    return { ok: false, error: "Enter a valid deposited amount." };

  const confirmed_by_role = firstHeld(user.roleKeys, [
    "errand_liaison",
    "accounting",
    "managing_officer",
  ]);
  const { error } = await supabase
    .from("transmittals")
    .update({ status: "deposited", deposit_slip_ref, deposited_amount, confirmed_by_role })
    .eq("id", id)
    .eq("status", "submitted");
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "transmittals",
    entityId: id,
    diff: { status: "deposited", deposit_slip_ref },
  });
  revalidatePath("/transmittals");
  revalidatePath(`/transmittals/${id}`);
  return { ok: true };
}

/** accounting records that the bank passbook was returned to them. */
export async function returnPassbook(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("transmittals");
  if (!userHasAnyRole(user, ["accounting", "managing_officer"]))
    return { ok: false, error: "Only accounting records the passbook return." };

  const supabase = await createClient();
  const passbook_returned_by_role = firstHeld(user.roleKeys, ["accounting", "managing_officer"]);
  const { error } = await supabase
    .from("transmittals")
    .update({ passbook_returned_on: todayManila(), passbook_returned_by_role })
    .eq("id", id)
    .in("status", ["deposited", "reconciled"]);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "transmittals",
    entityId: id,
    diff: { passbook_returned: true },
  });
  revalidatePath("/transmittals");
  revalidatePath(`/transmittals/${id}`);
  return { ok: true };
}

/** accounting reconciles the deposit slip. */
export async function reconcileTransmittal(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("transmittals");
  if (!userHasAnyRole(user, ["accounting", "managing_officer"]))
    return { ok: false, error: "Only accounting can reconcile." };

  const supabase = await createClient();
  const reconciled_by_role = firstHeld(user.roleKeys, ["accounting", "managing_officer"]);
  const { error } = await supabase
    .from("transmittals")
    .update({ status: "reconciled", reconciled_by_role })
    .eq("id", id)
    .eq("status", "deposited");
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "transmittals",
    entityId: id,
    diff: { status: "reconciled" },
  });
  revalidatePath("/transmittals");
  revalidatePath(`/transmittals/${id}`);
  return { ok: true };
}

export async function markTransmittalPrinted(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("transmittals");
  const supabase = await createClient();
  const { error } = await supabase
    .from("transmittals")
    .update({ printed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/transmittals/${id}`);
  return { ok: true };
}

/**
 * Advance a transmittal one hop along the chain of custody. Validates that the
 * actor holds a role permitted for the *next* stage, records the amount counted
 * at this hop + variance, and — on the final `deposited` hop — creates a linked
 * bank deposit. Every hop is stamped by role.
 */
export async function recordCustodyStep(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const { nextStage, canActOnStage, CUSTODY_STAGES } = await import("@/lib/collections/custody");
  const user = await requireModuleWrite("transmittals");
  const admin = createAdminClient();

  const { data: t } = await admin
    .from("transmittals")
    .select("id, total_amount, custody_stage")
    .eq("id", id)
    .maybeSingle();
  if (!t) return { ok: false, error: "Transmittal not found." };

  const current = (t.custody_stage as string) || "cashier_count";
  const stage = nextStage(current as never);
  if (!stage) return { ok: false, error: "Custody chain is already complete." };
  if (!canActOnStage(user.roleKeys, stage))
    return { ok: false, error: `Your role can't perform "${CUSTODY_STAGES[stage].label}".` };

  const def = CUSTODY_STAGES[stage];
  const expected = Number(t.total_amount);
  const countedRaw = String(formData.get("counted_amount") ?? "").trim();
  const counted = def.needs.counted && countedRaw ? Number(countedRaw) : null;
  if (def.needs.counted && (counted == null || !Number.isFinite(counted) || counted < 0))
    return { ok: false, error: "Enter the amount counted." };
  const variance = counted == null ? null : Math.round((counted - expected) * 100) / 100;

  const passbook_ref = def.needs.passbook ? String(formData.get("passbook_ref") ?? "").trim() || null : null;
  const deposit_slip_ref = def.needs.depositSlip ? String(formData.get("deposit_slip_ref") ?? "").trim() || null : null;
  const bank_account_id = def.needs.bankAccount ? String(formData.get("bank_account_id") ?? "").trim() || null : null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (def.needs.passbook && !passbook_ref) return { ok: false, error: "Enter the passbook reference." };
  if (def.needs.depositSlip && !deposit_slip_ref) return { ok: false, error: "Enter the deposit slip reference." };
  if (def.needs.bankAccount && !bank_account_id) return { ok: false, error: "Choose the bank account." };

  const actor_role = firstHeld(user.roleKeys, [...def.actorRoles, "admin", "managing_officer"]);

  const { error: cErr } = await admin.from("transmittal_custody").insert({
    transmittal_id: id, stage, actor_user_id: user.userId, actor_role,
    counted_amount: counted, expected_amount: expected, variance,
    passbook_ref, deposit_slip_ref, bank_account_id, note,
  });
  if (cErr) return { ok: false, error: cErr.message };

  // Reflect key facts onto the transmittal row.
  const patch: Record<string, unknown> = { custody_stage: stage };
  if (deposit_slip_ref) patch.deposit_slip_ref = deposit_slip_ref;
  if (stage === "deposited") {
    patch.status = "deposited";
    patch.confirmed_by_role = actor_role;
    if (counted != null) patch.deposited_amount = counted;
  }
  await admin.from("transmittals").update(patch).eq("id", id);

  // Final hop → create a linked bank deposit (pending clearance).
  if (stage === "deposited" && bank_account_id) {
    await admin.from("bank_transactions").insert({
      bank_account_id, direction: "in", amount: counted ?? expected, kind: "deposit",
      reference: deposit_slip_ref, counterparty: "Transmittal deposit",
      memo: `Transmittal ${id.slice(0, 8).toUpperCase()}`, status: "pending",
      transmittal_id: id, created_by: user.userId, actor_role,
    });
  }

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "transmittal_custody", entityId: id, diff: { stage, counted, variance } });

  // When accounting marks as deposited → notify errand_liaison with next business day.
  if (stage === "deposited") {
    const nbd = nextBusinessDay(todayManila());
    void createNotification({
      kind: "deposit_confirmed",
      title: `Deposit confirmed — bank it by ${nbd}`,
      body: `Transmittal ${id.slice(0, 8).toUpperCase()} has been handed over. Please deposit at the bank by ${nbd} (next business day).`,
      link: `/transmittals/${id}`,
      entityType: "transmittal",
      entityId: id,
      recipientRole: "errand_liaison",
      createdBy: user.userId,
    });
    // Also notify accounting for their own records.
    void createNotification({
      kind: "deposit_confirmed",
      title: `Transmittal ${id.slice(0, 8).toUpperCase()} marked deposited`,
      body: deposit_slip_ref ? `Slip ref: ${deposit_slip_ref}.` : null,
      link: `/transmittals/${id}`,
      entityType: "transmittal",
      entityId: id,
      recipientRole: "accounting",
      createdBy: user.userId,
    });
  }

  revalidatePath(`/transmittals/${id}`);
  revalidatePath("/transmittals");
  if (stage === "deposited" && bank_account_id) revalidatePath(`/banking/${bank_account_id}`);
  return { ok: true };
}
