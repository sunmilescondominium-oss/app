"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuth,
  requireModuleWrite,
  userHasAnyRole,
} from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { computeSOA } from "@/lib/computation";
import { todayManila } from "@/lib/collections/summary";
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
