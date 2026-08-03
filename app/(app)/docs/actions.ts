"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { DOC_PHOTO_BUCKET, ENTITY_MODULE, type DocEntity } from "@/lib/docs/photos";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Attach a live-captured photo to any documented entity. */
export async function uploadDocPhoto(
  entity: DocEntity,
  entityId: string,
  kind: string,
  formData: FormData,
): Promise<ActionResult> {
  const module = ENTITY_MODULE[entity];
  if (!module) return { ok: false, error: "Unknown record type." };

  const user = await requireAuth();
  if (!canWriteModule(user.roleKeys, module)) return { ok: false, error: "You can't add photos here." };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, error: "No photo captured." };
  if (photo.size > 8 * 1024 * 1024) return { ok: false, error: "Photo too large (max 8 MB)." };
  const capturedAt = String(formData.get("captured_at") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const admin = createAdminClient();
  // Ensure the private bucket exists (idempotent).
  await admin.storage.createBucket(DOC_PHOTO_BUCKET, { public: false }).catch(() => {});

  const path = `${entity}/${entityId}/${kind}-${Date.now()}.jpg`;
  const up = await admin.storage
    .from(DOC_PHOTO_BUCKET)
    .upload(path, new Uint8Array(await photo.arrayBuffer()), { contentType: photo.type || "image/jpeg" });
  if (up.error) return { ok: false, error: up.error.message };

  const actorRole = user.roleKeys[0] ?? null;
  const { error } = await admin.from("doc_photos").insert({
    entity, entity_id: entityId, kind, storage_path: path,
    actor_user_id: user.userId, actor_role: actorRole, captured_at: capturedAt, note,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "doc_photos", entityId, diff: { entity, kind } });
  revalidatePath(MODULE_PATH[module] ?? "/");
  return { ok: true };
}

const MODULE_PATH: Partial<Record<string, string>> = {
  transmittals: "/transmittals",
  housekeeping: "/housekeeping",
  rentals: "/rentals",
  incidents: "/incidents",
};
