"use server";

import { revalidatePath } from "next/cache";
import { requireModule, requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { ADVANCE_APPROVER_ROLES, ADVANCE_RELEASE_ROLES } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { todayManila } from "@/lib/collections/summary";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function requestAdvance(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModule("advances");
  const amount = Number(formData.get("amount") ?? "");
  const purpose = String(formData.get("purpose") ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a valid amount." };
  if (!purpose) return { ok: false, error: "State the purpose." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cash_advances")
    .insert({ user_id: user.userId, amount, purpose, needed_by: String(formData.get("needed_by") ?? "").trim() || null })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "cash_advances", entityId: data.id, diff: { amount, purpose } });
  revalidatePath("/advances");
  return { ok: true };
}

export async function cancelAdvance(id: string): Promise<ActionResult> {
  const user = await requireModule("advances");
  const admin = createAdminClient();
  const { error } = await admin.from("cash_advances").update({ status: "cancelled" }).eq("id", id).eq("user_id", user.userId).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/advances");
  return { ok: true };
}

export async function decideAdvance(id: string, status: "approved" | "rejected", note?: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ADVANCE_APPROVER_ROLES)) return { ok: false, error: "You cannot approve advances." };
  if (status !== "approved" && status !== "rejected") return { ok: false, error: "Invalid decision." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("cash_advances")
    .update({ status, decided_by: user.userId, decided_at: new Date().toISOString(), decision_note: note || null })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "cash_advances", entityId: id, diff: { status } });
  revalidatePath("/advances");
  revalidatePath(`/advances/${id}`);
  return { ok: true };
}

export async function releaseAdvance(id: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ADVANCE_RELEASE_ROLES)) return { ok: false, error: "Only accounting/admin can release funds." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("cash_advances")
    .update({ status: "released", released_by: user.userId, released_on: todayManila() })
    .eq("id", id)
    .eq("status", "approved");
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "cash_advances", entityId: id, diff: { status: "released" } });
  revalidatePath("/advances");
  revalidatePath(`/advances/${id}`);
  return { ok: true };
}

/** Add a liquidation line (requester or a manager). */
export async function addLiquidation(advanceId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireModule("advances");
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "");
  if (!description) return { ok: false, error: "Describe the expense." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid amount." };

  const admin = createAdminClient();
  const { data: adv } = await admin.from("cash_advances").select("user_id, status").eq("id", advanceId).maybeSingle();
  if (!adv) return { ok: false, error: "Advance not found." };
  const isOwner = adv.user_id === user.userId;
  if (!isOwner && !userHasAnyRole(user, ADVANCE_APPROVER_ROLES)) return { ok: false, error: "Not allowed." };
  if (!["released", "liquidated"].includes(adv.status as string)) return { ok: false, error: "Advance must be released before liquidation." };

  const { error } = await admin.from("cash_advance_liquidations").insert({
    advance_id: advanceId,
    description,
    amount,
    spent_on: String(formData.get("spent_on") ?? "").trim() || todayManila(),
    created_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "cash_advance_liquidations", entityId: advanceId, diff: { amount } });
  revalidatePath(`/advances/${advanceId}`);
  return { ok: true };
}

/** Close liquidation: total the lines, mark the advance liquidated. */
export async function closeLiquidation(advanceId: string): Promise<ActionResult> {
  const user = await requireModule("advances");
  const admin = createAdminClient();
  const { data: adv } = await admin.from("cash_advances").select("user_id, status").eq("id", advanceId).maybeSingle();
  if (!adv) return { ok: false, error: "Advance not found." };
  if (adv.user_id !== user.userId && !userHasAnyRole(user, ADVANCE_APPROVER_ROLES)) return { ok: false, error: "Not allowed." };
  if (adv.status !== "released") return { ok: false, error: "Only a released advance can be liquidated." };

  const { data: lines } = await admin.from("cash_advance_liquidations").select("amount").eq("advance_id", advanceId);
  const total = Math.round((lines ?? []).reduce((s, l) => s + Number(l.amount), 0) * 100) / 100;

  const { error } = await admin
    .from("cash_advances")
    .update({ status: "liquidated", liquidated_total: total, liquidated_on: todayManila() })
    .eq("id", advanceId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "cash_advances", entityId: advanceId, diff: { status: "liquidated", total } });
  revalidatePath("/advances");
  revalidatePath(`/advances/${advanceId}`);
  return { ok: true };
}
