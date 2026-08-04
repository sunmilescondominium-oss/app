import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ModuleKey } from "@/lib/rbac/modules";

export const DOC_PHOTO_BUCKET = "doc-photos";

export type DocEntity = "transmittal" | "housekeeping_task" | "stock_count" | "lease" | "incident" | "stay" | "requisition";

/** Which module governs read/write access for each documented entity. */
export const ENTITY_MODULE: Record<DocEntity, ModuleKey> = {
  transmittal: "transmittals",
  housekeeping_task: "housekeeping",
  stock_count: "housekeeping",
  lease: "rentals",
  incident: "incidents",
  stay: "hotel",
  requisition: "requisitions",
};

export interface DocPhoto {
  id: string;
  entity: string;
  entity_id: string;
  kind: string;
  media_type: "image" | "video";
  actor_role: string | null;
  captured_at: string | null;
  server_at: string;
  note: string | null;
  /** captured_at is more than 5 min off server receipt time → suspicious. */
  stale: boolean;
}

export async function listDocPhotos(entity: DocEntity, entityId: string): Promise<DocPhoto[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("doc_photos")
    .select("id, entity, entity_id, kind, media_type, actor_role, captured_at, server_at, note")
    .eq("entity", entity)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => {
    const cap = r.captured_at ? new Date(r.captured_at as string).getTime() : null;
    const srv = new Date(r.server_at as string).getTime();
    return {
      id: r.id as string,
      entity: r.entity as string,
      entity_id: r.entity_id as string,
      kind: r.kind as string,
      media_type: ((r.media_type as string) ?? "image") as "image" | "video",
      actor_role: (r.actor_role as string) ?? null,
      captured_at: (r.captured_at as string) ?? null,
      server_at: r.server_at as string,
      note: (r.note as string) ?? null,
      stale: cap != null ? Math.abs(srv - cap) > 5 * 60 * 1000 : false,
    };
  });
}
