import { createAdminClient } from "@/lib/supabase/admin";

export interface NotifRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  recipientRole: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CreateNotifOpts {
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  recipientRole?: string | null;
  recipientUserId?: string | null;
  createdBy?: string | null;
}

/** Insert one notification. Fire-and-forget — never throws. */
export async function createNotification(opts: CreateNotifOpts): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      kind: opts.kind,
      title: opts.title,
      body: opts.body ?? null,
      link: opts.link ?? null,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      recipient_role: opts.recipientRole ?? null,
      recipient_user_id: opts.recipientUserId ?? null,
      created_by: opts.createdBy ?? null,
    });
  } catch { /* never block the caller */ }
}

function mapRow(r: Record<string, unknown>): NotifRow {
  return {
    id: r.id as string,
    kind: r.kind as string,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    link: (r.link as string | null) ?? null,
    entityType: (r.entity_type as string | null) ?? null,
    entityId: (r.entity_id as string | null) ?? null,
    recipientRole: (r.recipient_role as string | null) ?? null,
    readAt: (r.read_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/** Fetch up to 50 recent notifications for this user (by role or direct). */
export async function listNotificationsForUser(
  userId: string,
  roleKeys: string[],
): Promise<NotifRow[]> {
  const admin = createAdminClient();
  const roleFilter = roleKeys.map((r) => `recipient_role.eq.${r}`).join(",");
  const filter = roleFilter
    ? `recipient_user_id.eq.${userId},${roleFilter}`
    : `recipient_user_id.eq.${userId}`;

  const { data } = await admin
    .from("notifications")
    .select("*")
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

/** Count of unread notifications for badge display. */
export async function countUnreadNotifications(
  userId: string,
  roleKeys: string[],
): Promise<number> {
  const admin = createAdminClient();
  const roleFilter = roleKeys.map((r) => `recipient_role.eq.${r}`).join(",");
  const filter = roleFilter
    ? `recipient_user_id.eq.${userId},${roleFilter}`
    : `recipient_user_id.eq.${userId}`;

  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .or(filter)
    .is("read_at", null);
  return count ?? 0;
}

/** Mark one notification read (admin client — user already owns it via role). */
export async function markNotificationRead(id: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
}

/** Mark ALL notifications for this user/role as read. */
export async function markAllNotificationsReadForUser(
  userId: string,
  roleKeys: string[],
): Promise<void> {
  const admin = createAdminClient();
  const roleFilter = roleKeys.map((r) => `recipient_role.eq.${r}`).join(",");
  const filter = roleFilter
    ? `recipient_user_id.eq.${userId},${roleFilter}`
    : `recipient_user_id.eq.${userId}`;
  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .or(filter)
    .is("read_at", null);
}
