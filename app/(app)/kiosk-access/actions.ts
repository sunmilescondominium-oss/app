"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getKioskSettings } from "@/lib/kiosk/settings";
import { FALLBACK_AUTHORIZER_ROLES, userIsStaff } from "@/lib/kiosk/fallback";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** Generate a short, human-readable code (no ambiguous chars). */
function genCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[randomInt(alphabet.length)];
  return s;
}

/** Guard (or an operator role) reports the kiosk is down and lists employees. */
export async function requestKioskFallback(input: {
  employeeNos: string[];
  punchKind: "in" | "out";
  reason: string;
}): Promise<ActionResult> {
  const actor = await requireModuleWrite("kiosk_fallback");
  if (!input.reason.trim()) return { ok: false, error: "A reason/note is required — no code is generated without it." };
  const nos = Array.from(new Set(input.employeeNos.map((n) => n.trim()).filter(Boolean)));
  if (nos.length === 0) return { ok: false, error: "Enter at least one employee ID." };
  if (nos.length > 100) return { ok: false, error: "Too many IDs in one request." };
  const admin = createAdminClient();

  // Resolve each employee_no → an active staff profile.
  const resolved: { userId: string; employeeNo: string }[] = [];
  const bad: string[] = [];
  for (const no of nos) {
    const { data } = await admin.from("profiles").select("id, is_active").eq("employee_no", no).maybeSingle();
    if (!data || !data.is_active || !(await userIsStaff(data.id as string))) { bad.push(no); continue; }
    resolved.push({ userId: data.id as string, employeeNo: no });
  }
  if (resolved.length === 0) return { ok: false, error: `No valid employee IDs (unknown/inactive: ${bad.join(", ")}).` };

  const { data: outage, error } = await admin
    .from("kiosk_outages")
    .insert({ status: "pending", punch_kind: input.punchKind, reason: input.reason.trim() || null, requested_by: actor.userId })
    .select("id")
    .single();
  if (error || !outage) return { ok: false, error: error?.message ?? "Could not create the request." };

  const grants = resolved.map((r) => ({ outage_id: outage.id, user_id: r.userId, employee_no: r.employeeNo }));
  const { error: gErr } = await admin.from("kiosk_outage_grants").insert(grants);
  if (gErr) return { ok: false, error: gErr.message };

  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "create", entity: "kiosk_outages", entityId: outage.id, diff: { requested: resolved.length, skipped: bad, punchKind: input.punchKind } });
  revalidatePath("/kiosk-access");
  return { ok: true, id: outage.id };
}

/** Authorizer approves → generates the temporary code + sets the expiry. */
export async function approveKioskFallback(outageId: string): Promise<ActionResult> {
  const actor = await requireModuleWrite("kiosk_fallback");
  if (!userHasAnyRole(actor, FALLBACK_AUTHORIZER_ROLES)) return { ok: false, error: "Only an authorizer (owner / managing officer / consultant / operations manager) can approve." };
  const admin = createAdminClient();
  const { data: cur } = await admin.from("kiosk_outages").select("status").eq("id", outageId).maybeSingle();
  if (!cur) return { ok: false, error: "Request not found." };
  if (cur.status !== "pending") return { ok: false, error: `Request is already ${cur.status}.` };

  const { mobileFallbackHours } = await getKioskSettings();
  const expires = new Date(Date.now() + Math.max(1, mobileFallbackHours) * 3_600_000).toISOString();
  const code = genCode();
  const { error } = await admin
    .from("kiosk_outages")
    .update({ status: "active", code, approved_by: actor.userId, approved_at: new Date().toISOString(), expires_at: expires })
    .eq("id", outageId);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "kiosk_outages", entityId: outageId, diff: { approved: true, expires_at: expires } });
  revalidatePath("/kiosk-access");
  return { ok: true, id: outageId };
}

export async function rejectKioskFallback(outageId: string, reason: string): Promise<ActionResult> {
  const actor = await requireModuleWrite("kiosk_fallback");
  if (!userHasAnyRole(actor, FALLBACK_AUTHORIZER_ROLES)) return { ok: false, error: "Only an authorizer can reject." };
  const admin = createAdminClient();
  const { error } = await admin.from("kiosk_outages").update({ status: "rejected", reject_reason: reason.trim() || "No reason given.", closed_by: actor.userId, closed_at: new Date().toISOString() }).eq("id", outageId).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "kiosk_outages", entityId: outageId, diff: { rejected: true } });
  revalidatePath("/kiosk-access");
  return { ok: true };
}

/** Guard/operator deactivates when the kiosk is back — normal use resumes. */
export async function closeKioskFallback(outageId: string): Promise<ActionResult> {
  const actor = await requireModuleWrite("kiosk_fallback");
  const admin = createAdminClient();
  const { error } = await admin
    .from("kiosk_outages")
    .update({ status: "closed", closed_by: actor.userId, closed_at: new Date().toISOString() })
    .eq("id", outageId)
    .in("status", ["active", "pending"]);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "kiosk_outages", entityId: outageId, diff: { closed: true } });
  revalidatePath("/kiosk-access");
  return { ok: true };
}
