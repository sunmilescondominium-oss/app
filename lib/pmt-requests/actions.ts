"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string };

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function createPmtRequest(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("pmt_requests");
  const admin = createAdminClient();

  const requestorUserId = fd.get("requestor_user_id") as string;
  const expiresAt = fd.get("expires_at") as string;
  const payeeName = ((fd.get("payee_name") as string) ?? "").trim() || null;
  const purpose = ((fd.get("purpose") as string) ?? "").trim() || null;
  const paymentType = (fd.get("payment_type") as "check" | "petty_cash") || null;
  const primarySourceType = (fd.get("primary_source_type") as "bank" | "petty_cash") || null;
  const primarySourceId = (fd.get("primary_source_id") as string) || null;
  const primarySourceAmount = fd.get("primary_source_amount") ? Number(fd.get("primary_source_amount")) : null;
  const secondarySourceType = (fd.get("secondary_source_type") as "bank" | "petty_cash") || null;
  const secondarySourceId = (fd.get("secondary_source_id") as string) || null;
  const secondarySourceAmount = fd.get("secondary_source_amount") ? Number(fd.get("secondary_source_amount")) : null;

  if (!requestorUserId) return { ok: false, error: "Select a requestor." };
  if (!expiresAt) return { ok: false, error: "Set a link expiry date." };

  const { data, error } = await admin.from("pmt_requests").insert({
    created_by: user.userId,
    requestor_user_id: requestorUserId,
    expires_at: new Date(expiresAt).toISOString(),
    payee_name: payeeName,
    purpose,
    payment_type: paymentType,
    primary_source_type: primarySourceType,
    primary_source_id: primarySourceId,
    primary_source_amount: primarySourceAmount,
    secondary_source_type: secondarySourceType,
    secondary_source_id: secondarySourceId,
    secondary_source_amount: secondarySourceAmount,
  }).select("id, link_token").single();

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys as string[],
    action: "create",
    entity: "pmt_requests",
    entityId: data.id,
  });
  revalidatePath("/pmt-requests");
  return { ok: true, data: { token: data.link_token } };
}

export async function approvePmtRequest(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("pmt_requests");
  const admin = createAdminClient();

  const id = fd.get("id") as string;
  const approvalNote = ((fd.get("approval_note") as string) ?? "").trim() || null;

  const { data: req } = await admin
    .from("pmt_requests")
    .select("status, requestor_user_id, purpose, amount_requested")
    .eq("id", id)
    .maybeSingle();
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "submitted") return { ok: false, error: "Must be in submitted status to approve." };

  const { error } = await admin.from("pmt_requests").update({
    status: "approved",
    approved_by: user.userId,
    approved_at: new Date().toISOString(),
    approval_note: approvalNote,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  const amount = req.amount_requested ? ` for ${peso(Number(req.amount_requested))}` : "";
  const noteText = approvalNote ? `\n\nNote: ${approvalNote}` : "";
  await admin.from("chat_messages").insert({
    sender_id: user.userId,
    recipient_id: req.requestor_user_id,
    body: `✅ Your payment request${amount} — "${req.purpose ?? "No purpose stated"}" has been approved.${noteText}`,
  });

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys as string[], action: "approve", entity: "pmt_requests", entityId: id });
  revalidatePath("/pmt-requests");
  return { ok: true };
}

export async function rejectPmtRequest(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("pmt_requests");
  const admin = createAdminClient();

  const id = fd.get("id") as string;
  const rejectionReason = ((fd.get("rejection_reason") as string) ?? "").trim();
  if (!rejectionReason) return { ok: false, error: "Rejection reason is required." };

  const { data: req } = await admin
    .from("pmt_requests")
    .select("status, requestor_user_id, purpose, amount_requested")
    .eq("id", id)
    .maybeSingle();
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "submitted") return { ok: false, error: "Must be in submitted status to reject." };

  const { error } = await admin.from("pmt_requests").update({
    status: "rejected",
    rejection_reason: rejectionReason,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  const amount = req.amount_requested ? ` for ${peso(Number(req.amount_requested))}` : "";
  await admin.from("chat_messages").insert({
    sender_id: user.userId,
    recipient_id: req.requestor_user_id,
    body: `❌ Your payment request${amount} — "${req.purpose ?? "No purpose stated"}" was not approved.\n\nReason: ${rejectionReason}`,
  });

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys as string[], action: "reject", entity: "pmt_requests", entityId: id });
  revalidatePath("/pmt-requests");
  return { ok: true };
}

export async function releasePmtBudget(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("pmt_requests");
  const admin = createAdminClient();

  const id = fd.get("id") as string;
  const { data: req } = await admin.from("pmt_requests").select("*").eq("id", id).maybeSingle();
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "approved") return { ok: false, error: "Must be approved before releasing budget." };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const { data: expense, error: expErr } = await admin.from("expenses").insert({
    business_line: "general",
    category: "Payment Request",
    amount: req.amount_requested ?? 0,
    expense_date: today,
    vendor: req.payee_name,
    remarks: req.purpose,
    source: req.primary_source_type === "petty_cash" ? "petty_cash" : "bank",
    bank_account_id: req.primary_source_type === "bank" ? req.primary_source_id : null,
  }).select("id").single();

  if (expErr) return { ok: false, error: expErr.message };

  if (req.primary_source_type === "petty_cash" && req.primary_source_id) {
    await admin.from("petty_cash_transactions").insert({
      fund_id: req.primary_source_id,
      kind: "disbursement",
      amount: req.primary_source_amount ?? req.amount_requested ?? 0,
      expense_id: expense.id,
      description: req.purpose,
      created_by: user.userId,
    });
  }
  if (req.secondary_source_type === "petty_cash" && req.secondary_source_id && req.secondary_source_amount) {
    await admin.from("petty_cash_transactions").insert({
      fund_id: req.secondary_source_id,
      kind: "disbursement",
      amount: req.secondary_source_amount,
      expense_id: expense.id,
      description: `${req.purpose ?? "Payment request"} (secondary)`,
      created_by: user.userId,
    });
  }

  const { error } = await admin.from("pmt_requests").update({
    status: "released",
    budget_released_by: user.userId,
    budget_released_at: new Date().toISOString(),
    expense_id: expense.id,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  const amount = req.amount_requested ? ` of ${peso(Number(req.amount_requested))}` : "";
  await admin.from("chat_messages").insert({
    sender_id: user.userId,
    recipient_id: req.requestor_user_id,
    body: `💰 The budget${amount} for your payment request — "${req.purpose ?? "Request"}" is now available. Please coordinate with accounting for release.`,
  });

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys as string[], action: "release", entity: "pmt_requests", entityId: id });
  revalidatePath("/pmt-requests");
  return { ok: true };
}
