"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { DISPUTE_STATUSES } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUSES: readonly string[] = DISPUTE_STATUSES.map((s) => s.key);

function baseFields(formData: FormData) {
  return {
    unit_id: String(formData.get("unit_id") ?? "").trim() || null,
    case_ref: String(formData.get("case_ref") ?? "").trim() || null,
    issue_type: String(formData.get("issue_type") ?? "").trim() || "General",
    status: String(formData.get("status") ?? "open"),
    last_action: String(formData.get("last_action") ?? "").trim() || null,
    next_action: String(formData.get("next_action") ?? "").trim() || null,
    target_date: String(formData.get("target_date") ?? "").trim() || null,
  };
}

export async function createDispute(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("disputes");
  const supabase = await createClient();

  const patch: Record<string, unknown> = { ...baseFields(formData), created_by: user.userId };
  if (!STATUSES.includes(patch.status as string)) return { ok: false, error: "Choose a status." };
  // Only a consultant may set lawyer notes.
  if (userHasAnyRole(user, ["consultant"]))
    patch.lawyer_notes = String(formData.get("lawyer_notes") ?? "").trim() || null;

  const { data, error } = await supabase.from("disputes").insert(patch).select("id").single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "disputes",
    entityId: data.id as string,
    diff: { issue_type: patch.issue_type, status: patch.status },
  });
  revalidatePath("/disputes");
  return { ok: true };
}

export async function updateDispute(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("disputes");
  const supabase = await createClient();

  const patch: Record<string, unknown> = baseFields(formData);
  if (!STATUSES.includes(patch.status as string)) return { ok: false, error: "Choose a status." };
  // Preserve existing lawyer_notes unless a consultant is editing them.
  if (userHasAnyRole(user, ["consultant"]))
    patch.lawyer_notes = String(formData.get("lawyer_notes") ?? "").trim() || null;

  const { error } = await supabase.from("disputes").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "disputes",
    entityId: id,
    diff: { status: patch.status },
  });
  revalidatePath("/disputes");
  return { ok: true };
}
