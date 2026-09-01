import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";

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

/**
 * Scan for postdated checks due today or tomorrow and create notifications for
 * accounting + errand_liaison. Idempotent — skips if notification already exists
 * for that collection. Called fire-and-forget from the app layout.
 */
export async function notifyPostdatedChecksDue(): Promise<void> {
  try {
    const admin = createAdminClient();
    const today = todayManila();
    const tomorrow = new Date(`${today}T00:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const { data: checks } = await admin
      .from("collections")
      .select("id, amount, check_number, check_date, check_bank, unit_id, units(unit_number)")
      .not("check_date", "is", null)
      .gte("check_date", today)
      .lte("check_date", tomorrowStr)
      .is("deleted_at", null)
      .limit(50);

    if (!checks || checks.length === 0) return;

    // Batch-fetch already-notified collection ids — one query instead of one per check.
    const checkIds = checks.map((c) => c.id as string);
    const { data: existing } = await admin
      .from("notifications")
      .select("entity_id")
      .eq("kind", "postdated_check_due")
      .in("entity_id", checkIds);
    const notified = new Set((existing ?? []).map((r) => r.entity_id as string));

    for (const c of checks) {
      if (notified.has(c.id as string)) continue;

      const checkDate = c.check_date as string;
      const isToday = checkDate === today;
      const unitNum = ((c.units as { unit_number?: string } | null)?.unit_number as string | null) ?? "";
      const amt = (Number(c.amount) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
      const detail = `Check #${(c.check_number as string | null) ?? "—"} (${(c.check_bank as string | null) ?? "—"}) ₱${amt}${unitNum ? ` — Unit ${unitNum}` : ""} — ${checkDate}`;

      await createNotification({
        kind: "postdated_check_due",
        title: `Check due for deposit ${isToday ? "today" : "tomorrow"}`,
        body: detail,
        link: "/collections",
        entityType: "collection",
        entityId: c.id as string,
        recipientRole: "accounting",
      });
      await createNotification({
        kind: "postdated_check_due",
        title: `Check ready for bank deposit ${isToday ? "today" : "tomorrow"}`,
        body: detail,
        link: "/collections",
        entityType: "collection",
        entityId: c.id as string,
        recipientRole: "errand_liaison",
      });
    }
  } catch { /* never block the layout render */ }
}

/**
 * Find transmittals that have been in a non-terminal state for more than 1 day
 * and contain check collections. Notifies accounting + hotel_rental_monitoring
 * to move the transmittal forward. Idempotent — skips if already notified today.
 */
export async function notifyStaleTransmittals(): Promise<void> {
  try {
    const admin = createAdminClient();
    const today = todayManila();
    // "stale" = created more than 24h ago and not yet deposited/reconciled
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stale } = await admin
      .from("transmittals")
      .select("id, transmittal_date, status, total_amount")
      .in("status", ["draft", "submitted"])
      .lt("created_at", cutoff)
      .is("deleted_at", null)
      .limit(20);

    if (!stale || stale.length === 0) return;

    // Determine which of these have at least one check collection.
    const staleIds = stale.map((t) => t.id as string);
    const { data: checkCols } = await admin
      .from("collections")
      .select("transmittal_id")
      .in("transmittal_id", staleIds)
      .eq("payment_type", "check")
      .is("deleted_at", null);

    const checkTransmittalIds = new Set((checkCols ?? []).map((c) => c.transmittal_id as string));
    const staleWithChecks = stale.filter((t) => checkTransmittalIds.has(t.id as string));
    if (staleWithChecks.length === 0) return;

    // Idempotent: skip transmittals already notified today.
    const todayCutoff = `${today}T00:00:00.000Z`;
    const { data: already } = await admin
      .from("notifications")
      .select("entity_id")
      .eq("kind", "stale_transmittal_checks")
      .gte("created_at", todayCutoff)
      .in("entity_id", staleWithChecks.map((t) => t.id as string));
    const notifiedToday = new Set((already ?? []).map((r) => r.entity_id as string));

    for (const t of staleWithChecks) {
      if (notifiedToday.has(t.id as string)) continue;
      const amt = (Number(t.total_amount) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
      const detail = `Transmittal ref ${(t.id as string).slice(0, 8).toUpperCase()} (${t.transmittal_date as string}) — ₱${amt} — status: ${t.status as string}. Physical checks need to reach the bank.`;

      for (const role of ["accounting", "hotel_rental_monitoring"] as const) {
        await createNotification({
          kind: "stale_transmittal_checks",
          title: "Check transmittal pending deposit — action needed",
          body: detail,
          link: `/transmittals/${t.id as string}`,
          entityType: "transmittal",
          entityId: t.id as string,
          recipientRole: role,
        });
      }
    }
  } catch { /* never block layout render */ }
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
