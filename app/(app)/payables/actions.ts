"use server";

import { revalidatePath } from "next/cache";
import { requireModule, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { PAYABLE_APPROVER_ROLES, PAYABLE_RELEASE_ROLES } from "@/lib/payables/queries";
import { PAYABLE_TYPES, type PayableType } from "@/lib/payables/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const VALID_TYPES = PAYABLE_TYPES.map((t) => t.key) as readonly string[];

/** Add a payee (broker / agent / staff / supplier). Agents link to a broker. */
export async function createPayee(input: {
  name: string; kind: string; parentPayeeId: string; overrideRate: number; commissionRate: number; tin: string; contact: string;
}): Promise<ActionResult> {
  const user = await requireModuleWrite("payables");
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  const admin = createAdminClient();
  const { error } = await admin.from("payees").insert({
    name: input.name.trim(), kind: input.kind,
    parent_payee_id: input.parentPayeeId || null,
    override_rate: pct(input.overrideRate), commission_rate: pct(input.commissionRate),
    tin: input.tin.trim() || null, contact: input.contact.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "payees", entityId: null, diff: { name: input.name, kind: input.kind } });
  revalidatePath("/payables");
  return { ok: true };
}

/** Accept a rate as a percent (2 → 0.02) or a fraction (0.02 → 0.02). */
function pct(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > 1 ? v / 100 : v;
}

/**
 * Create a payable. If it's a COMMISSION to an agent whose broker has an
 * override rate, a linked OVERRIDE payable is auto-created for the broker.
 */
export async function createPayable(input: {
  payeeId: string; ptype: PayableType; amount: number; description: string; businessLine: string; refNo: string;
}): Promise<ActionResult> {
  const user = await requireModuleWrite("payables");
  if (!input.payeeId) return { ok: false, error: "Choose a payee." };
  if (!VALID_TYPES.includes(input.ptype)) return { ok: false, error: "Invalid type." };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a valid amount." };

  const admin = createAdminClient();
  const { data: base, error } = await admin.from("payables").insert({
    payee_id: input.payeeId, ptype: input.ptype, amount, description: input.description.trim() || null,
    business_line: input.businessLine.trim() || null, ref_no: input.refNo.trim() || null,
    requested_by: user.userId,
  }).select("id").single();
  if (error || !base) return { ok: false, error: error?.message ?? "Could not save." };

  let overrideNote = "";
  if (input.ptype === "commission") {
    const { data: payee } = await admin.from("payees").select("parent_payee_id, override_rate").eq("id", input.payeeId).maybeSingle();
    const rate = Number(payee?.override_rate ?? 0);
    if (payee?.parent_payee_id && rate > 0) {
      const overrideAmt = Math.round(amount * rate * 100) / 100;
      await admin.from("payables").insert({
        payee_id: payee.parent_payee_id, ptype: "override", amount: overrideAmt,
        description: `Override (${Math.round(rate * 100)}%) on commission ${input.refNo || ""}`.trim(),
        business_line: input.businessLine.trim() || null, ref_no: input.refNo.trim() || null,
        parent_payable_id: base.id, requested_by: user.userId,
      });
      overrideNote = ` + ₱${overrideAmt.toLocaleString("en-PH")} broker override`;
    }
  }

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "payables", entityId: base.id, diff: { ptype: input.ptype, amount, override: Boolean(overrideNote) } });
  revalidatePath("/payables");
  return { ok: true, id: base.id };
}

async function transition(id: string, allowed: string[], patch: Record<string, unknown>, fromStatuses: string[], step: string): Promise<ActionResult> {
  const user = await requireModule("payables");
  if (!userHasAnyRole(user, allowed)) return { ok: false, error: "Your role can't take this step." };
  const admin = createAdminClient();
  const { data: cur } = await admin.from("payables").select("status").eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "Not found." };
  if (!fromStatuses.includes(cur.status as string)) return { ok: false, error: `Already ${cur.status}.` };
  const { error } = await admin.from("payables").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "payables", entityId: id, diff: { step } });
  revalidatePath("/payables");
  return { ok: true };
}

export async function approvePayable(id: string): Promise<ActionResult> {
  const user = await requireModule("payables");
  return transition(id, PAYABLE_APPROVER_ROLES, { status: "approved", approved_by: user.userId, approved_at: new Date().toISOString() }, ["pending"], "approve");
}

export async function releasePayable(id: string, orNo: string, method: string): Promise<ActionResult> {
  const user = await requireModule("payables");
  return transition(id, PAYABLE_RELEASE_ROLES, { status: "released", released_by: user.userId, released_at: new Date().toISOString(), release_or_no: orNo.trim() || null, release_method: method.trim() || null }, ["approved"], "release");
}

export async function cancelPayable(id: string): Promise<ActionResult> {
  return transition(id, PAYABLE_APPROVER_ROLES, { status: "cancelled" }, ["pending", "approved"], "cancel");
}
