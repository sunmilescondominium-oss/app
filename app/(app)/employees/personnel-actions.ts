"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const FIELDS = [
  "address", "birthdate", "phone", "personal_email", "emergency_name", "emergency_phone",
  "sss_no", "philhealth_no", "pagibig_no", "tin_no",
  "position", "department", "employment_type", "date_hired", "date_regularized", "notes",
] as const;

const DATE_FIELDS = new Set(["birthdate", "date_hired", "date_regularized"]);

/** Save (upsert) an employee's 201 personnel record. */
export async function saveEmployeeProfile(userId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("employees");
  if (!userId) return { ok: false, error: "Missing employee." };

  const row: Record<string, string | null> = { user_id: userId };
  for (const f of FIELDS) {
    const v = String(formData.get(f) ?? "").trim();
    row[f] = v === "" ? null : v;
    if (DATE_FIELDS.has(f) && row[f] && !/^\d{4}-\d{2}-\d{2}$/.test(row[f]!)) row[f] = null;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("employee_profiles").upsert(row, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "employee_profiles",
    entityId: userId,
    diff: { updated: true },
  });
  revalidatePath(`/employees/${userId}`);
  return { ok: true };
}

/** Upload a document to an employee's private folder. */
export async function uploadEmployeeDoc(userId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("employees");
  const docType = String(formData.get("doc_type") ?? "").trim() || "Other";
  const note = String(formData.get("note") ?? "").trim() || null;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file." };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "File too large (max 15 MB)." };

  const admin = createAdminClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safe}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const up = await admin.storage.from("employee-documents").upload(path, bytes, { contentType: file.type || "application/octet-stream" });
  if (up.error) return { ok: false, error: up.error.message };

  const { error } = await admin.from("employee_documents").insert({ user_id: userId, doc_type: docType, file_path: path, note, uploaded_by: user.userId });
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "employee_documents", entityId: userId, diff: { doc_type: docType } });
  revalidatePath(`/employees/${userId}`);
  return { ok: true };
}

export async function deleteEmployeeDoc(id: string, userId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("employees");
  const admin = createAdminClient();
  const { data: doc } = await admin.from("employee_documents").select("file_path").eq("id", id).maybeSingle();
  if (doc?.file_path) await admin.storage.from("employee-documents").remove([doc.file_path as string]);
  const { error } = await admin.from("employee_documents").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "employee_documents", entityId: id });
  revalidatePath(`/employees/${userId}`);
  return { ok: true };
}
