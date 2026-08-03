import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listDocPhotos, type DocPhoto } from "@/lib/docs/photos";

export interface Incident {
  id: string;
  title: string;
  category: string;
  location: string | null;
  description: string | null;
  status: string;
  reported_by_role: string | null;
  created_at: string;
  resolved_at: string | null;
  photos: DocPhoto[];
}

export async function listIncidents(limit = 100): Promise<Incident[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];

  // Batch the photos for all listed incidents.
  const admin = createAdminClient();
  const ids = rows.map((r) => r.id as string);
  const { data: pics } = ids.length
    ? await admin.from("doc_photos").select("id, entity, entity_id, kind, actor_role, captured_at, server_at, note").eq("entity", "incident").in("entity_id", ids).order("created_at", { ascending: false })
    : { data: [] };
  const byId = new Map<string, DocPhoto[]>();
  for (const p of pics ?? []) {
    const cap = p.captured_at ? new Date(p.captured_at as string).getTime() : null;
    const srv = new Date(p.server_at as string).getTime();
    const photo: DocPhoto = {
      id: p.id as string, entity: p.entity as string, entity_id: p.entity_id as string, kind: p.kind as string,
      actor_role: (p.actor_role as string) ?? null, captured_at: (p.captured_at as string) ?? null,
      server_at: p.server_at as string, note: (p.note as string) ?? null,
      stale: cap != null ? Math.abs(srv - cap) > 5 * 60 * 1000 : false,
    };
    (byId.get(photo.entity_id) ?? byId.set(photo.entity_id, []).get(photo.entity_id)!).push(photo);
  }

  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    category: r.category as string,
    location: (r.location as string) ?? null,
    description: (r.description as string) ?? null,
    status: r.status as string,
    reported_by_role: (r.reported_by_role as string) ?? null,
    created_at: r.created_at as string,
    resolved_at: (r.resolved_at as string) ?? null,
    photos: byId.get(r.id as string) ?? [],
  }));
}

/** Fetch documentation photos for one incident (used after create). */
export async function incidentPhotos(id: string): Promise<DocPhoto[]> {
  return listDocPhotos("incident", id);
}
