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
import { computeSOA } from "@/lib/computation";
import { todayManila } from "@/lib/collections/summary";
import type { ImportResult } from "@/lib/imports/types";
import type { BulkResult } from "@/lib/data/bulk";

const HARD_DELETE_ROLES = ["admin", "managing_officer", "consultant"];

/** Bulk deactivate buyers (soft — keeps SOA history). */
export async function bulkSetBuyersActive(ids: string[], active: boolean): Promise<BulkResult> {
  const user = await requireModuleWrite("buyers");
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  const admin = createAdminClient();
  const { error } = await admin.from("buyers").update({ is_active: active }).in("id", list);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: active ? "update" : "delete", entity: "buyers", entityId: null, diff: { bulk_active: active, count: list.length } });
  revalidatePath("/buyers");
  return { ok: true, affected: list.length, skipped: [] };
}

/** Bulk PERMANENT delete buyers (cascades their SOA/payments/documents). */
export async function bulkDeleteBuyers(ids: string[]): Promise<BulkResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, HARD_DELETE_ROLES)) return { ok: false, error: "Only an admin or managing officer can permanently delete." };
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  if (list.length > 500) return { ok: false, error: "Select 500 or fewer rows per delete." };
  const admin = createAdminClient();
  let affected = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const id of list) {
    const { error } = await admin.from("buyers").delete().eq("id", id);
    if (error) skipped.push({ id, reason: /foreign key|violates/i.test(error.message) ? "referenced by other records (deactivate instead)" : error.message });
    else affected += 1;
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "buyers", entityId: null, diff: { hard_delete: true, deleted: affected, skipped: skipped.length } });
  revalidatePath("/buyers");
  return { ok: true, affected, skipped };
}

/** Bulk-import buyers from a CSV (unit resolved by unit_number). */
export async function bulkImportBuyers(rows: Record<string, string>[]): Promise<ImportResult> {
  const user = await requireModuleWrite("buyers");
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 5000) return { ok: false, error: "Too many rows (max 5000)." };

  const SCHEMES = ["step_up", "fixed", "balloon"];
  const STATUSES = ["current", "overdue", "restructured", "in_dispute"];
  const admin = createAdminClient();
  const unitCache = new Map<string, string | null>();
  const errors: { row: number; error: string }[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2; // header + 1-index
    const unitNo = (r.unit_number ?? "").trim();
    const pin = (r.ref_pin ?? "").trim();
    if (!unitNo) { errors.push({ row: line, error: "unit_number is required" }); continue; }
    if (!pin) { errors.push({ row: line, error: "ref_pin is required" }); continue; }

    const key = unitNo.toLowerCase();
    if (!unitCache.has(key)) {
      const { data } = await admin.from("units").select("id").ilike("unit_number", unitNo).limit(1).maybeSingle();
      unitCache.set(key, (data?.id as string) ?? null);
    }
    const unitId = unitCache.get(key);
    if (!unitId) { errors.push({ row: line, error: `unit "${unitNo}" not found` }); continue; }

    const scheme = (r.payment_scheme ?? "fixed").trim() || "fixed";
    if (!SCHEMES.includes(scheme)) { errors.push({ row: line, error: `invalid payment_scheme "${scheme}"` }); continue; }
    const status = (r.payment_status ?? "current").trim() || "current";
    if (!STATUSES.includes(status)) { errors.push({ row: line, error: `invalid payment_status "${status}"` }); continue; }

    toInsert.push({
      unit_id: unitId,
      contact_label: (r.contact_label ?? "Buyer").trim() || "Buyer",
      ref_pin: pin,
      payment_scheme: scheme,
      payment_status: status,
      tcp: r.tcp ? Number(r.tcp) : null,
      downpayment: r.downpayment ? Number(r.downpayment) : 0,
      term_months: r.term_months ? Math.trunc(Number(r.term_months)) : 60,
      start_date: (r.start_date ?? "").trim() || undefined,
    });
  }

  let inserted = 0;
  if (toInsert.length) {
    const { error } = await admin.from("buyers").insert(toInsert);
    if (error) return { ok: false, error: error.message };
    inserted = toInsert.length;
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "buyers", entityId: null, diff: { imported: inserted, skipped: errors.length } });
  revalidatePath("/buyers");
  return { ok: true, inserted, errors };
}
import { PAYMENT_SCHEMES, BUYER_STATUSES, PAYMENT_DOC_TYPES } from "@/lib/config";
import type { SOAInput } from "@/lib/computation/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
type Supabase = Awaited<ReturnType<typeof createClient>>;

const SCHEMES: readonly string[] = PAYMENT_SCHEMES.map((s) => s.key);
const STATUSES: readonly string[] = BUYER_STATUSES.map((s) => s.key);
const DOCS: readonly string[] = PAYMENT_DOC_TYPES.map((d) => d.key);

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function genPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Recompute + snapshot the SOA and refresh the buyer's derived status. */
async function regenerate(supabase: Supabase, buyerId: string): Promise<void> {
  const { data: b } = await supabase
    .from("buyers")
    .select("*, units(tcp)")
    .eq("id", buyerId)
    .maybeSingle();
  if (!b) return;

  const { data: pays } = await supabase
    .from("payments")
    .select("amount, paid_on")
    .eq("buyer_id", buyerId);

  const unitTcp = (b.units as { tcp?: number | null } | null)?.tcp;
  const input: SOAInput = {
    scheme: b.payment_scheme as SOAInput["scheme"],
    tcp: Number(b.tcp ?? unitTcp ?? 0),
    downpayment: Number(b.downpayment ?? 0),
    term_months: (b.term_months as number) ?? 60,
    annual_interest_rate: b.annual_interest_rate != null ? Number(b.annual_interest_rate) : null,
    start_date: b.start_date as string,
    asOf: todayManila(),
    payments: (pays ?? []).map((p: Record<string, unknown>) => ({
      amount: Number(p.amount),
      paid_on: p.paid_on as string,
    })),
  };

  const soa = await computeSOA(input);
  await supabase.from("buyer_soa").insert({
    buyer_id: buyerId,
    computed_json: soa,
    contract_balance: soa.totals.contract_balance,
    next_due_date: soa.next_due_date,
    source: soa.source,
    params_version: soa.params_version,
  });

  const status = b.payment_status as string;
  if (status !== "restructured" && status !== "in_dispute") {
    const derived = soa.totals.amount_due_now > 0.01 ? "overdue" : "current";
    if (derived !== status)
      await supabase.from("buyers").update({ payment_status: derived }).eq("id", buyerId);
  }
}

export async function createBuyer(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("buyers");
  const supabase = await createClient();

  const payment_scheme = String(formData.get("payment_scheme") ?? "fixed");
  if (!SCHEMES.includes(payment_scheme)) return { ok: false, error: "Choose a payment scheme." };

  const { data, error } = await supabase
    .from("buyers")
    .insert({
      unit_id: String(formData.get("unit_id") ?? "").trim() || null,
      contact_label: String(formData.get("contact_label") ?? "").trim() || "Buyer",
      ref_pin: String(formData.get("ref_pin") ?? "").trim() || genPin(),
      payment_scheme,
      start_date: String(formData.get("start_date") ?? "").trim() || todayManila(),
      tcp: num(formData.get("tcp")),
      downpayment: num(formData.get("downpayment")) ?? 0,
      term_months: num(formData.get("term_months")) ?? 60,
      annual_interest_rate: num(formData.get("annual_interest_rate")),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await regenerate(supabase, data.id as string);
  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "buyers",
    entityId: data.id as string,
    diff: { payment_scheme },
  });
  revalidatePath("/buyers");
  return { ok: true };
}

export async function updateBuyer(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("buyers");
  const supabase = await createClient();

  const payment_scheme = String(formData.get("payment_scheme") ?? "fixed");
  if (!SCHEMES.includes(payment_scheme)) return { ok: false, error: "Choose a payment scheme." };

  const patch = {
    unit_id: String(formData.get("unit_id") ?? "").trim() || null,
    contact_label: String(formData.get("contact_label") ?? "").trim() || "Buyer",
    ref_pin: String(formData.get("ref_pin") ?? "").trim() || genPin(),
    payment_scheme,
    start_date: String(formData.get("start_date") ?? "").trim() || todayManila(),
    tcp: num(formData.get("tcp")),
    downpayment: num(formData.get("downpayment")) ?? 0,
    term_months: num(formData.get("term_months")) ?? 60,
    annual_interest_rate: num(formData.get("annual_interest_rate")),
  };
  const { error } = await supabase.from("buyers").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await regenerate(supabase, id);
  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "buyers",
    entityId: id,
    diff: patch,
  });
  revalidatePath("/buyers");
  revalidatePath(`/buyers/${id}`);
  return { ok: true };
}

export async function recordPayment(
  buyerId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("buyers");
  const supabase = await createClient();

  const amount = num(formData.get("amount"));
  const doc_type = String(formData.get("doc_type") ?? "OR");
  if (amount == null || amount < 0) return { ok: false, error: "Enter a valid amount." };
  if (!DOCS.includes(doc_type)) return { ok: false, error: "Choose a document type." };

  const { error } = await supabase.from("payments").insert({
    buyer_id: buyerId,
    doc_type,
    or_number: String(formData.get("or_number") ?? "").trim() || null,
    amount,
    paid_on: String(formData.get("paid_on") ?? "").trim() || todayManila(),
    remarks: String(formData.get("remarks") ?? "").trim() || null,
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };

  await regenerate(supabase, buyerId);
  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "payments",
    entityId: buyerId,
    diff: { amount, doc_type },
  });
  revalidatePath(`/buyers/${buyerId}`);
  revalidatePath("/buyers");
  return { ok: true };
}

export async function regenerateSOA(buyerId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("buyers");
  const supabase = await createClient();
  await regenerate(supabase, buyerId);
  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "buyer_soa",
    entityId: buyerId,
    diff: { regenerated: true },
  });
  revalidatePath(`/buyers/${buyerId}`);
  return { ok: true };
}

export async function setBuyerStatus(id: string, status: string): Promise<ActionResult> {
  const user = await requireModuleWrite("buyers");
  if (!STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  const supabase = await createClient();
  const { error } = await supabase.from("buyers").update({ payment_status: status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "buyers",
    entityId: id,
    diff: { payment_status: status },
  });
  revalidatePath(`/buyers/${id}`);
  revalidatePath("/buyers");
  return { ok: true };
}

/** Edit a computation parameter (admin/consultant). Bumps params_version so new
 *  SOAs are versioned; existing snapshots stay reproducible. */
export async function updateComputationParam(
  key: string,
  value: number,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "consultant"]))
    return { ok: false, error: "Only an admin or consultant can edit computation parameters." };
  if (!Number.isFinite(value)) return { ok: false, error: "Invalid value." };

  const supabase = await createClient();
  const { error } = await supabase.from("computation_params").update({ value }).eq("key", key);
  if (error) return { ok: false, error: error.message };

  if (key !== "params_version") {
    const { data: pv } = await supabase
      .from("computation_params")
      .select("value")
      .eq("key", "params_version")
      .maybeSingle();
    const next = (pv ? Number(pv.value) : 1) + 1;
    await supabase.from("computation_params").update({ value: next }).eq("key", "params_version");
  }

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "computation_params",
    entityId: key,
    diff: { key, value },
  });
  revalidatePath("/buyers");
  return { ok: true };
}
