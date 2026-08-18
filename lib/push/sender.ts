import "server-only";
import webpush, { type PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;
function configure() {
  if (configured) return;
  const subject  = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  const pubKey   = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const privKey  = process.env.VAPID_PRIVATE_KEY ?? "";
  if (!pubKey || !privKey) return; // silently skip if not configured
  webpush.setVapidDetails(subject, pubKey, privKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/** Send a push to one subscription endpoint. Returns false if the subscription is stale. */
async function sendOne(endpoint: string, p256dh: string, auth: string, payload: PushPayload): Promise<boolean> {
  configure();
  const sub: PushSubscription = { endpoint, keys: { p256dh, auth } };
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false; // subscription gone
    throw err;
  }
}

/** Send push notification to all subscribed users matching the given user IDs.
 *  Stale subscriptions are deleted automatically.
 *  Returns the number of pushes sent.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  eventKey: string,
  cooldownMinutes = 10,
): Promise<number> {
  if (!userIds.length) return 0;
  configure();
  if (!configured) return 0;

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const cooldownMs = cooldownMinutes * 60_000;
  const cooldownIso = new Date(Date.now() - cooldownMs).toISOString();

  // Get subscriptions for these users
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs || subs.length === 0) return 0;

  // Check which (user_id, event_key) pairs are within the cooldown window
  const { data: recent } = await admin
    .from("push_notifications_log")
    .select("user_id")
    .in("user_id", userIds)
    .eq("event_key", eventKey)
    .gte("sent_at", cooldownIso);
  const recentSet = new Set((recent ?? []).map((r) => r.user_id as string));

  let sent = 0;
  const staleIds: string[] = [];

  for (const sub of subs) {
    const uid = sub.user_id as string;
    if (recentSet.has(uid)) continue; // within cooldown

    const ok = await sendOne(
      sub.endpoint as string,
      sub.p256dh as string,
      sub.auth as string,
      payload,
    ).catch(() => false);

    if (ok) {
      sent++;
      // Log the send
      await admin.from("push_notifications_log").insert({
        user_id: uid,
        event_key: eventKey,
        sent_at: nowIso,
      });
    } else {
      staleIds.push(sub.id as string);
    }
  }

  // Remove stale subscriptions
  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return sent;
}

/** Convenience: send to all subscribed users holding any of the given role keys. */
export async function sendPushToRoles(
  roleKeys: string[],
  payload: PushPayload,
  eventKey: string,
  cooldownMinutes = 10,
): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role_key", roleKeys);
  const userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
  return sendPushToUsers(userIds, payload, eventKey, cooldownMinutes);
}
