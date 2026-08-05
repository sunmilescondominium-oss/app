"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { FORM_MANAGER_ROLES } from "@/lib/forms/queries";
import { SERIAL_STATUSES, type SerialStatus } from "@/lib/forms/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function actingRole(roleKeys: string[], allowed: string[]): string | null {
  return roleKeys.find((r) => allowed.includes(r)) ?? roleKeys[0] ?? null;
}

/** Register a new booklet and materialize every serial in its range. */
/** Register a BIR business entity (one of the company's registered businesses). */
export async function createBusinessEntity(input: { name: string; tradeName: string; tin: string; rdo: string; address: string }): Promise<ActionResult> {
  const user = await requireModuleWrite("accountable_forms");
  if (!userHasAnyRole(user, FORM_MANAGER_ROLES)) return { ok: false, error: "Not allowed." };
  if (!input.name.trim()) return { ok: false, error: "Business name is required." };
  const admin = createAdminClient();
  const { error } = await admin.from("business_entities").insert({ name: input.name.trim(), trade_name: input.tradeName.trim() || null, tin: input.tin.trim() || null, bir_rdo: input.rdo.trim() || null, registered_address: input.address.trim() || null });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "business_entities", entityId: null, diff: { name: input.name } });
  revalidatePath("/forms");
  return { ok: true };
}

export async function createBooklet(input: {
  formTypeId: string; bookletNo: string; prefix: string; from: number; to: number; padWidth: number;
  custodianUserId: string; custodianRole: string; receivedFrom: string; receivedAt: string; notes: string;
  businessEntityId?: string; birAtpNo?: string; birAtpDate?: string; printerName?: string; printerAccreditation?: string;
}): Promise<ActionResult> {
  const user = await requireModuleWrite("accountable_forms");
  if (!userHasAnyRole(user, FORM_MANAGER_ROLES)) return { ok: false, error: "Only accounting / admin / monitoring can register booklets." };
  const from = Math.trunc(input.from), to = Math.trunc(input.to);
  if (!input.formTypeId) return { ok: false, error: "Choose a form type." };
  if (!input.bookletNo.trim()) return { ok: false, error: "Booklet number is required." };
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return { ok: false, error: "Enter a valid serial range." };
  if (to - from + 1 > 1000) return { ok: false, error: "Range too large (max 1000 serials per booklet)." };

  const admin = createAdminClient();
  const pad = Math.max(0, Math.min(12, Math.trunc(input.padWidth)));
  const { data: booklet, error } = await admin.from("form_booklets").insert({
    form_type_id: input.formTypeId, booklet_no: input.bookletNo.trim(), prefix: input.prefix.trim(),
    serial_from: from, serial_to: to, pad_width: pad,
    custodian_user_id: input.custodianUserId || null, custodian_role: input.custodianRole || null,
    received_from: input.receivedFrom.trim() || null, received_at: input.receivedAt || null, notes: input.notes.trim() || null,
    business_entity_id: input.businessEntityId || null,
    bir_atp_no: input.birAtpNo?.trim() || null, bir_atp_date: input.birAtpDate || null,
    printer_name: input.printerName?.trim() || null, printer_accreditation: input.printerAccreditation?.trim() || null,
  }).select("id").single();
  if (error || !booklet) return { ok: false, error: error?.message ?? "Could not create the booklet." };

  const rows = [];
  for (let n = from; n <= to; n++) {
    rows.push({ booklet_id: booklet.id, form_type_id: input.formTypeId, serial_no: n, serial_label: `${input.prefix.trim()}${String(n).padStart(pad, "0")}` });
  }
  const { error: sErr } = await admin.from("form_serials").insert(rows);
  if (sErr) return { ok: false, error: sErr.message };

  if (input.custodianUserId) {
    await admin.from("form_custody").insert({ booklet_id: booklet.id, to_user_id: input.custodianUserId, to_role: input.custodianRole || null, changed_by: user.userId, note: "Booklet registered / received" });
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "form_booklets", entityId: booklet.id, diff: { bookletNo: input.bookletNo, range: `${from}-${to}` } });
  revalidatePath("/forms");
  return { ok: true, id: booklet.id };
}

/** Mark a serial used / cancelled / spoiled / void (or back to unused). */
export async function setSerialStatus(serialId: string, status: SerialStatus, meta: { issuedTo?: string; reference?: string; amount?: number; remarks?: string } = {}): Promise<ActionResult> {
  const user = await requireModuleWrite("accountable_forms");
  if (!SERIAL_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    status,
    issued_to: meta.issuedTo?.trim() || null,
    reference: meta.reference?.trim() || null,
    amount: Number.isFinite(meta.amount) ? meta.amount : null,
    remarks: meta.remarks?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (status === "unused") { patch.used_by_user_id = null; patch.used_by_role = null; patch.used_at = null; }
  else { patch.used_by_user_id = user.userId; patch.used_by_role = actingRole(user.roleKeys, ["hotel_cashier", "accounting", "admin", "managing_officer", "hotel_rental_monitoring"]); patch.used_at = new Date().toISOString(); }

  const { data: cur } = await admin.from("form_serials").select("booklet_id, serial_label").eq("id", serialId).maybeSingle();
  const { error } = await admin.from("form_serials").update(patch).eq("id", serialId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "form_serials", entityId: serialId, diff: { status, serial: cur?.serial_label } });
  if (cur?.booklet_id) revalidatePath(`/forms/${cur.booklet_id}`);
  revalidatePath("/forms");
  return { ok: true };
}

/** Hand a booklet's custody to another staff member (logs the turnover). */
export async function reassignCustodian(bookletId: string, toUserId: string, toRole: string, note: string): Promise<ActionResult> {
  const user = await requireModuleWrite("accountable_forms");
  if (!userHasAnyRole(user, FORM_MANAGER_ROLES)) return { ok: false, error: "Only accounting / admin / monitoring can reassign custody." };
  if (!toUserId) return { ok: false, error: "Choose the new custodian." };
  const admin = createAdminClient();
  const { data: b } = await admin.from("form_booklets").select("custodian_user_id, custodian_role").eq("id", bookletId).maybeSingle();
  const { error } = await admin.from("form_booklets").update({ custodian_user_id: toUserId, custodian_role: toRole || null, updated_at: new Date().toISOString() }).eq("id", bookletId);
  if (error) return { ok: false, error: error.message };
  await admin.from("form_custody").insert({ booklet_id: bookletId, from_user_id: b?.custodian_user_id ?? null, from_role: b?.custodian_role ?? null, to_user_id: toUserId, to_role: toRole || null, changed_by: user.userId, note: note.trim() || "Custody reassigned" });
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "form_booklets", entityId: bookletId, diff: { custody_to: toUserId } });
  revalidatePath(`/forms/${bookletId}`);
  return { ok: true };
}

export async function closeBooklet(bookletId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("accountable_forms");
  if (!userHasAnyRole(user, FORM_MANAGER_ROLES)) return { ok: false, error: "Not allowed." };
  const admin = createAdminClient();
  const { error } = await admin.from("form_booklets").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", bookletId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "form_booklets", entityId: bookletId, diff: { closed: true } });
  revalidatePath("/forms");
  revalidatePath(`/forms/${bookletId}`);
  return { ok: true };
}

export async function createFormType(code: string, name: string, birReportable = true): Promise<ActionResult> {
  const user = await requireModuleWrite("accountable_forms");
  if (!userHasAnyRole(user, FORM_MANAGER_ROLES)) return { ok: false, error: "Not allowed." };
  if (!code.trim() || !name.trim()) return { ok: false, error: "Code and name are required." };
  const admin = createAdminClient();
  const { error } = await admin.from("form_types").insert({ code: code.trim().toUpperCase(), name: name.trim(), bir_reportable: birReportable });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "form_types", entityId: null, diff: { code, name } });
  revalidatePath("/forms");
  return { ok: true };
}
