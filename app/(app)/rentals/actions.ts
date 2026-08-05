"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite, requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { todayManila } from "@/lib/collections/summary";
import { CLEANING_CHECKLIST } from "@/lib/config";
import type { BulkResult } from "@/lib/data/bulk";

export type ActionResult = { ok: true } | { ok: false; error: string };

const HARD_DELETE_ROLES = ["admin", "managing_officer", "consultant"];

/** Bulk end leases (soft — marks ended, frees the unit). */
export async function bulkEndLeases(ids: string[]): Promise<BulkResult> {
  const user = await requireModuleWrite("rentals");
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  const admin = createAdminClient();
  const { data: rows } = await admin.from("leases").select("unit_id").in("id", list).eq("status", "active");
  const { error } = await admin.from("leases").update({ status: "ended", end_at: new Date().toISOString(), portal_token: null }).in("id", list);
  if (error) return { ok: false, error: error.message };
  const unitIds = Array.from(new Set((rows ?? []).map((r) => r.unit_id as string)));
  if (unitIds.length) await admin.from("units").update({ status: "available" }).in("id", unitIds);
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "leases", entityId: null, diff: { bulk_end: list.length } });
  revalidatePath("/rentals");
  revalidatePath("/rentals/tenants");
  return { ok: true, affected: list.length, skipped: [] };
}

/** Bulk PERMANENT delete leases (cascades lease documents; keeps dues). */
export async function bulkDeleteLeases(ids: string[]): Promise<BulkResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, HARD_DELETE_ROLES)) return { ok: false, error: "Only an admin or managing officer can permanently delete." };
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  if (list.length > 500) return { ok: false, error: "Select 500 or fewer rows per delete." };
  const admin = createAdminClient();
  let affected = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const id of list) {
    const { error } = await admin.from("leases").delete().eq("id", id);
    if (error) skipped.push({ id, reason: /foreign key|violates/i.test(error.message) ? "referenced by other records (end lease instead)" : error.message });
    else affected += 1;
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "leases", entityId: null, diff: { hard_delete: true, deleted: affected, skipped: skipped.length } });
  revalidatePath("/rentals/tenants");
  return { ok: true, affected, skipped };
}

/** Bulk-import current tenants (leases) from CSV, resolving unit by number. */
export async function bulkImportLeases(rows: Record<string, string>[]): Promise<import("@/lib/imports/types").ImportResult> {
  const user = await requireModuleWrite("rentals");
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 5000) return { ok: false, error: "Too many rows (max 5000)." };

  const admin = createAdminClient();
  const errors: { row: number; error: string }[] = [];
  const toInsert: Record<string, unknown>[] = [];
  const unitCache = new Map<string, { id: string; line: string } | null>();
  const activeCache = new Map<string, boolean>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const unitNo = (r.unit_number ?? "").trim();
    const tenant = (r.tenant_label ?? "").trim();
    if (!unitNo) { errors.push({ row: line, error: "unit_number is required" }); continue; }
    if (!tenant) { errors.push({ row: line, error: "tenant_label is required" }); continue; }

    const key = unitNo.toLowerCase();
    if (!unitCache.has(key)) {
      const { data } = await admin.from("units").select("id, business_line").ilike("unit_number", unitNo).in("business_line", ["rental", "airbnb"]).limit(1).maybeSingle();
      unitCache.set(key, data ? { id: data.id as string, line: data.business_line as string } : null);
    }
    const unit = unitCache.get(key);
    if (!unit) { errors.push({ row: line, error: `rental/airbnb unit "${unitNo}" not found` }); continue; }

    if (!activeCache.has(unit.id)) {
      const { data } = await admin.from("leases").select("id").eq("unit_id", unit.id).eq("status", "active").limit(1).maybeSingle();
      activeCache.set(unit.id, Boolean(data));
    }
    if (activeCache.get(unit.id)) { errors.push({ row: line, error: `unit "${unitNo}" already has an active lease` }); continue; }
    activeCache.set(unit.id, true); // prevent a second row filling the same unit

    const cycle = (r.billing_cycle ?? "").trim() || (unit.line === "airbnb" ? "nightly" : "monthly");
    toInsert.push({
      unit_id: unit.id,
      business_line: unit.line,
      tenant_label: tenant,
      contact: (r.contact ?? "").trim() || null,
      rent_amount: r.rent_amount ? Number(r.rent_amount) : 0,
      billing_cycle: cycle,
      deposit: r.deposit ? Number(r.deposit) : 0,
      portal_pin: (r.portal_pin ?? "").trim() || null,
      start_date: (r.start_date ?? "").trim() || undefined,
      status: "active",
    });
  }

  let inserted = 0;
  if (toInsert.length) {
    const { error } = await admin.from("leases").insert(toInsert);
    if (error) return { ok: false, error: error.message };
    inserted = toInsert.length;
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "leases", entityId: null, diff: { imported: inserted, skipped: errors.length } });
  revalidatePath("/rentals");
  revalidatePath("/rentals/tenants");
  return { ok: true, inserted, errors };
}

/** Convert a datetime-local value to a Manila (UTC+8) ISO timestamp. */
function manilaIso(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return new Date(`${s}:00+08:00`).toISOString();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function startLease(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("rentals");
  const unit_id = String(formData.get("unit_id") ?? "");
  const tenant_label = String(formData.get("tenant_label") ?? "").trim();
  if (!unit_id || !tenant_label) return { ok: false, error: "Choose a unit and enter the tenant/guest." };

  const admin = createAdminClient();
  const { data: unit } = await admin.from("units").select("business_line").eq("id", unit_id).maybeSingle();
  if (!unit) return { ok: false, error: "Unit not found." };

  const { data: existing } = await admin.from("leases").select("id").eq("unit_id", unit_id).eq("status", "active").maybeSingle();
  if (existing) return { ok: false, error: "This unit already has an active lease/booking." };

  // Must be cleaned (no open housekeeping task) before a new occupant.
  const { data: hk } = await admin.from("housekeeping_tasks").select("id").eq("unit_id", unit_id).in("status", ["pending", "in_progress"]).maybeSingle();
  if (hk) return { ok: false, error: "Unit needs housekeeping before it can be occupied." };

  const { data, error } = await admin
    .from("leases")
    .insert({
      unit_id,
      business_line: unit.business_line,
      tenant_label,
      contact: String(formData.get("contact") ?? "").trim() || null,
      start_date: String(formData.get("start_date") ?? "").trim() || todayManila(),
      end_at: manilaIso(String(formData.get("end_at") ?? "")),
      rent_amount: Number(formData.get("rent_amount") ?? "0") || 0,
      billing_cycle: String(formData.get("billing_cycle") ?? "monthly"),
      deposit: Number(formData.get("deposit") ?? "0") || 0,
      notes: String(formData.get("notes") ?? "").trim() || null,
      lease_type: String(formData.get("lease_type") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      permanent_address: String(formData.get("permanent_address") ?? "").trim() || null,
      emergency_contact: String(formData.get("emergency_contact") ?? "").trim() || null,
      emergency_phone: String(formData.get("emergency_phone") ?? "").trim() || null,
      motor_plate: String(formData.get("motor_plate") ?? "").trim() || null,
      transferred_from: String(formData.get("transferred_from") ?? "").trim() || null,
      portal_token: (await import("node:crypto")).randomBytes(18).toString("base64url"),
      created_by: user.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await admin.from("units").update({ status: "occupied" }).eq("id", unit_id);
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "leases", entityId: data.id, diff: { unit_id, tenant_label } });
  revalidatePath("/rentals");
  return { ok: true };
}

export async function endLease(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("rentals");
  const admin = createAdminClient();
  const { data: lease } = await admin.from("leases").select("unit_id").eq("id", id).maybeSingle();
  // End of stay → revoke the Airbnb guest QR portal (same as hotel checkout).
  const { error } = await admin.from("leases").update({ status: "ended", portal_token: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (lease?.unit_id) {
    // Room stays "For Housekeeping" (not vacant) until cleaning is done.
    await admin.from("units").update({ status: "under_maintenance" }).eq("id", lease.unit_id);
    const { data: openHk } = await admin.from("housekeeping_tasks").select("id").eq("unit_id", lease.unit_id).in("status", ["pending", "in_progress"]).maybeSingle();
    if (!openHk) {
      await admin.from("housekeeping_tasks").insert({ unit_id: lease.unit_id, status: "pending", checklist: CLEANING_CHECKLIST.map((c) => ({ key: c.key, label: c.label, done: false })) });
    }
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "leases", entityId: id, diff: { status: "ended" } });
  revalidatePath("/rentals");
  return { ok: true };
}

/** Extend an Airbnb checkout / lease end (the extension option). */
export async function extendLease(id: string, endAt: string): Promise<ActionResult> {
  const user = await requireModuleWrite("rentals");
  const iso = manilaIso(endAt);
  if (!iso) return { ok: false, error: "Enter a valid new checkout time." };
  const admin = createAdminClient();
  const { error } = await admin.from("leases").update({ end_at: iso }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "leases", entityId: id, diff: { end_at: iso } });
  revalidatePath("/rentals");
  return { ok: true };
}

export async function addMeterReading(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("rentals");
  const unit_id = String(formData.get("unit_id") ?? "");
  const utility = String(formData.get("utility") ?? "");
  const reading = Number(formData.get("reading") ?? "");
  if (!unit_id || !["electric", "water"].includes(utility)) return { ok: false, error: "Choose a unit and utility." };
  if (!Number.isFinite(reading) || reading < 0) return { ok: false, error: "Enter a valid meter reading." };

  const admin = createAdminClient();
  const { error } = await admin.from("meter_readings").insert({
    unit_id,
    utility,
    reading,
    read_on: String(formData.get("read_on") ?? "").trim() || todayManila(),
    remarks: String(formData.get("remarks") ?? "").trim() || null,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "meter_readings", entityId: unit_id, diff: { utility, reading } });
  revalidatePath("/rentals");
  return { ok: true };
}

export async function createDue(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("rentals");
  const unit_id = String(formData.get("unit_id") ?? "");
  const due_date = String(formData.get("due_date") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "");
  if (!unit_id || !due_date) return { ok: false, error: "Choose a unit and due date." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a valid amount." };

  const category = String(formData.get("category") ?? "rent");
  const remarks = String(formData.get("remarks") ?? "").trim() || null;
  if ((category === "other" || category === "repairs") && !remarks)
    return { ok: false, error: "Specify the item for this charge." };

  const admin = createAdminClient();
  const { data: lease } = await admin.from("leases").select("id").eq("unit_id", unit_id).eq("status", "active").maybeSingle();
  const { error } = await admin.from("rental_dues").insert({
    unit_id,
    lease_id: lease?.id ?? null,
    category,
    due_date,
    amount,
    remarks,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "rental_dues", entityId: unit_id, diff: { amount, due_date } });
  revalidatePath("/rentals");
  return { ok: true };
}

/** Update renter contact/personal details on an active lease. */
export async function updateRenterDetails(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("rentals");
  const leaseId = String(formData.get("lease_id") ?? "");
  if (!leaseId) return { ok: false, error: "Missing lease." };
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("leases")
    .update({
      tenant_label: String(formData.get("tenant_label") ?? "").trim() || "Tenant",
      contact: str("contact"),
      email: str("email"),
      permanent_address: str("permanent_address"),
      emergency_contact: str("emergency_contact"),
      emergency_phone: str("emergency_phone"),
      motor_plate: str("motor_plate"),
      lease_type: str("lease_type"),
      transferred_from: str("transferred_from"),
      portal_pin: str("portal_pin"),
    })
    .eq("id", leaseId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "leases", entityId: leaseId, diff: { renter_details: true } });
  revalidatePath("/rentals");
  return { ok: true };
}

/** Mark a required renter document submitted / not, with an optional file. */
export async function setLeaseDocument(leaseId: string, docType: string, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("rentals");
  if (!leaseId || !docType) return { ok: false, error: "Missing lease or document." };
  const submitted = String(formData.get("submitted") ?? "") === "true";
  const note = String(formData.get("note") ?? "").trim() || null;

  const admin = createAdminClient();
  let file_path: string | undefined;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 12 * 1024 * 1024) return { ok: false, error: "File too large (max 12 MB)." };
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${leaseId}/${Date.now()}-${safe}`;
    const up = await admin.storage.from("lease-documents").upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
    if (up.error) return { ok: false, error: up.error.message };
    file_path = path;
  }

  const row: Record<string, unknown> = { lease_id: leaseId, doc_type: docType, submitted, note };
  if (file_path) row.file_path = file_path;
  const { error } = await admin.from("lease_documents").upsert(row, { onConflict: "lease_id,doc_type" });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "lease_documents", entityId: leaseId, diff: { doc_type: docType, submitted } });
  revalidatePath("/rentals");
  return { ok: true };
}

export async function markDuePaid(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("rentals");
  const admin = createAdminClient();
  // Issue an Acknowledgement Receipt from the monitoring-configured rental series.
  const { data: arNo } = await admin.rpc("next_receipt_no", { ctx: "rental" });
  const { error } = await admin.from("rental_dues").update({ status: "paid", paid_on: todayManila(), ar_no: (arNo as string | null) ?? null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "rental_dues", entityId: id, diff: { status: "paid" } });
  revalidatePath("/rentals");
  return { ok: true };
}
