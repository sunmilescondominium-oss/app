import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuditRow = {
  id: string;
  actorUserId: string | null;
  actorLabel: string | null;
  actorRoles: string[];
  action: string;
  entity: string;
  entityId: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditFilters = {
  actorUserId?: string;
  entity?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listAuditLog(
  filters: AuditFilters = {},
): Promise<{ rows: AuditRow[]; total: number }> {
  const admin = createAdminClient();
  const { page = 1, pageSize = 50, actorUserId, entity, action, dateFrom, dateTo } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("audit_log")
    .select("id, actor_user_id, actor_roles, action, entity, entity_id, diff, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (actorUserId) query = query.eq("actor_user_id", actorUserId);
  if (entity) query = query.eq("entity", entity);
  if (action) query = query.eq("action", action);
  if (dateFrom) query = query.gte("created_at", dateFrom + "T00:00:00.000Z");
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59.999Z");

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const actorIds = [
    ...new Set(
      (data ?? [])
        .filter((r) => r.actor_user_id)
        .map((r) => r.actor_user_id as string),
    ),
  ];
  const profileMap: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_label")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      profileMap[p.id as string] = (p.display_label as string) ?? "Unknown";
    }
  }

  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    actorUserId: (r.actor_user_id as string | null) ?? null,
    actorLabel: r.actor_user_id ? (profileMap[r.actor_user_id as string] ?? "Unknown") : null,
    actorRoles: (r.actor_roles as string[]) ?? [],
    action: r.action as string,
    entity: r.entity as string,
    entityId: (r.entity_id as string | null) ?? null,
    diff: (r.diff as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string,
  }));

  return { rows, total: count ?? 0 };
}

export type AuditActor = { id: string; label: string };

export async function listAuditFilterOptions(): Promise<{
  actors: AuditActor[];
  entities: string[];
  actions: string[];
}> {
  const admin = createAdminClient();

  const [metaRes, profilesRes] = await Promise.all([
    admin.from("audit_log").select("entity, action").limit(5000),
    admin.from("profiles").select("id, display_label").order("display_label"),
  ]);

  const entities = [
    ...new Set((metaRes.data ?? []).map((r) => r.entity as string)),
  ]
    .filter(Boolean)
    .sort();

  const actions = [
    ...new Set((metaRes.data ?? []).map((r) => r.action as string)),
  ]
    .filter(Boolean)
    .sort();

  const actors = (profilesRes.data ?? []).map((p) => ({
    id: p.id as string,
    label: (p.display_label as string) ?? "Unknown",
  }));

  return { entities, actions, actors };
}
