"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const CATEGORIES = ["security", "safety", "damage", "other"];

export async function createIncident(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("incidents");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return { ok: false, error: "Enter a short title." };
  if (!CATEGORIES.includes(category)) return { ok: false, error: "Invalid category." };

  const reported_by_role = user.roleKeys[0] ?? null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .insert({ title, category, location, description, reported_by_role, reported_by_user: user.userId })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "incidents", entityId: data?.id, diff: { category } });
  revalidatePath("/incidents");
  return { ok: true, id: data?.id as string };
}

export async function resolveIncident(id: string, resolved: boolean): Promise<ActionResult> {
  const user = await requireModuleWrite("incidents");
  const supabase = await createClient();
  const { error } = await supabase
    .from("incidents")
    .update({ status: resolved ? "resolved" : "open", resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "incidents", entityId: id, diff: { resolved } });
  revalidatePath("/incidents");
  return { ok: true };
}
