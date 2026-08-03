"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { todayManila } from "@/lib/collections/summary";
import { CLEANING_CHECKLIST } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
  const { error } = await admin.from("leases").update({ status: "ended" }).eq("id", id);
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
