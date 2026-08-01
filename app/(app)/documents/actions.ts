"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { DOCUMENT_STATUSES } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };
const DOC_STATUSES: readonly string[] = DOCUMENT_STATUSES.map((s) => s.key);

export async function setDocumentStatus(
  buyerId: string,
  documentTypeId: string,
  patch: { status: string; ref_number?: string | null; doc_date?: string | null; notes?: string | null },
): Promise<ActionResult> {
  const user = await requireModuleWrite("documents");
  if (!DOC_STATUSES.includes(patch.status)) return { ok: false, error: "Invalid status." };
  const supabase = await createClient();

  const { error } = await supabase.from("buyer_documents").upsert(
    {
      buyer_id: buyerId,
      document_type_id: documentTypeId,
      status: patch.status,
      ref_number: patch.ref_number || null,
      doc_date: patch.doc_date || null,
      notes: patch.notes || null,
    },
    { onConflict: "buyer_id,document_type_id" },
  );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "buyer_documents",
    entityId: `${buyerId}:${documentTypeId}`,
    diff: { status: patch.status },
  });
  revalidatePath(`/documents/${buyerId}`);
  return { ok: true };
}

export async function captureConsent(buyerId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("documents");
  const supabase = await createClient();
  const { error } = await supabase
    .from("buyers")
    .update({ id_consent_at: new Date().toISOString() })
    .eq("id", buyerId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "buyers",
    entityId: buyerId,
    diff: { id_consent: true },
  });
  revalidatePath(`/documents/${buyerId}`);
  return { ok: true };
}

export async function uploadDocumentScan(
  buyerId: string,
  documentTypeId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("documents");
  const supabase = await createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "File too large (max 10 MB)." };

  // RA 10173: sensitive IDs require captured consent.
  const { data: dt } = await supabase
    .from("document_types")
    .select("is_sensitive_id")
    .eq("id", documentTypeId)
    .maybeSingle();
  if (dt?.is_sensitive_id) {
    const { data: b } = await supabase
      .from("buyers")
      .select("id_consent_at")
      .eq("id", buyerId)
      .maybeSingle();
    if (!b?.id_consent_at)
      return { ok: false, error: "Capture data-privacy consent before uploading government IDs." };
  }

  const admin = createAdminClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${buyerId}/${documentTypeId}/${Date.now()}-${safe}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const up = await admin.storage
    .from("buyer-documents")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (up.error) return { ok: false, error: up.error.message };

  const { data: existing } = await supabase
    .from("buyer_documents")
    .select("id, status")
    .eq("buyer_id", buyerId)
    .eq("document_type_id", documentTypeId)
    .maybeSingle();

  if (existing) {
    const status = existing.status === "pending" ? "received" : (existing.status as string);
    await supabase
      .from("buyer_documents")
      .update({ file_path: path, status, uploaded_by: user.userId })
      .eq("id", existing.id);
  } else {
    await supabase.from("buyer_documents").insert({
      buyer_id: buyerId,
      document_type_id: documentTypeId,
      status: "received",
      file_path: path,
      uploaded_by: user.userId,
    });
  }

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "buyer_documents",
    entityId: `${buyerId}:${documentTypeId}`,
    diff: { uploaded: safe },
  });
  revalidatePath(`/documents/${buyerId}`);
  return { ok: true };
}
