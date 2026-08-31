import { createAdminClient } from "@/lib/supabase/admin";

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationPartner {
  userId: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  latestMessage: string;
  latestAt: string;
  unreadCount: number;
}

/** All unique conversation partners for a user, sorted by latest message desc. */
export async function listConversations(myUserId: string): Promise<ConversationPartner[]> {
  const admin = createAdminClient();

  // Get distinct partner IDs + latest message info
  const { data: msgs } = await admin
    .from("chat_messages")
    .select("sender_id, recipient_id, body, created_at, read_at")
    .or(`sender_id.eq.${myUserId},recipient_id.eq.${myUserId}`)
    .order("created_at", { ascending: false });

  if (!msgs || msgs.length === 0) return [];

  // Build a map: partnerId → { latestMessage, latestAt, unreadCount }
  const partnerMap = new Map<string, { latestMessage: string; latestAt: string; unreadCount: number }>();
  for (const m of msgs) {
    const partnerId = m.sender_id === myUserId ? m.recipient_id : m.sender_id;
    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, {
        latestMessage: m.body as string,
        latestAt: m.created_at as string,
        unreadCount: 0,
      });
    }
    // Count unread (messages sent TO me, not yet read)
    if (m.recipient_id === myUserId && !m.read_at) {
      partnerMap.get(partnerId)!.unreadCount++;
    }
  }

  const partnerIds = Array.from(partnerMap.keys());

  // Fetch profile info for all partners
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, display_name, role_label, avatar_url")
    .in("user_id", partnerIds);

  const profileMap = new Map((profiles ?? []).map((p) => [
    p.user_id as string,
    { displayName: (p.display_name as string) ?? "Unknown", roleLabel: p.role_label as string | null, avatarUrl: p.avatar_url as string | null },
  ]));

  return partnerIds
    .map((uid) => {
      const info = partnerMap.get(uid)!;
      const prof = profileMap.get(uid) ?? { displayName: "Unknown", roleLabel: null, avatarUrl: null };
      return {
        userId: uid,
        displayName: prof.displayName,
        roleLabel: prof.roleLabel,
        avatarUrl: prof.avatarUrl,
        latestMessage: info.latestMessage,
        latestAt: info.latestAt,
        unreadCount: info.unreadCount,
      };
    })
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

/** Load messages between two users (newest last, capped at 100). */
export async function getMessages(myUserId: string, partnerUserId: string): Promise<ChatMessage[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("chat_messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .or(
      `and(sender_id.eq.${myUserId},recipient_id.eq.${partnerUserId}),` +
      `and(sender_id.eq.${partnerUserId},recipient_id.eq.${myUserId})`,
    )
    .order("created_at", { ascending: true })
    .limit(100);

  return (data ?? []).map((m) => ({
    id: m.id as string,
    senderId: m.sender_id as string,
    recipientId: m.recipient_id as string,
    body: m.body as string,
    readAt: m.read_at as string | null,
    createdAt: m.created_at as string,
  }));
}

/** Mark all unread messages FROM partnerUserId TO myUserId as read. */
export async function markConversationRead(myUserId: string, partnerUserId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", partnerUserId)
    .eq("recipient_id", myUserId)
    .is("read_at", null);
}

/** Count total unread messages across all conversations for a user. */
export async function countUnreadChat(myUserId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", myUserId)
    .is("read_at", null);
  return count ?? 0;
}

export interface StaffProfile {
  userId: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  roleKeys: string[];
}

/** Fetch profiles for users whose primary role is in allowedRoles. */
export async function getChattableStaff(allowedRoles: string[], myUserId: string): Promise<StaffProfile[]> {
  if (allowedRoles.length === 0) return [];
  const admin = createAdminClient();

  // Profiles with any of the allowed role keys
  const { data } = await admin
    .from("profiles")
    .select("user_id, display_name, role_label, avatar_url, role_keys")
    .neq("user_id", myUserId)
    .not("role_keys", "is", null);

  if (!data) return [];

  return data
    .filter((p) => {
      const keys = (p.role_keys as string[] | null) ?? [];
      return keys.some((k) => allowedRoles.includes(k));
    })
    .map((p) => ({
      userId: p.user_id as string,
      displayName: (p.display_name as string) ?? "Unknown",
      roleLabel: p.role_label as string | null,
      avatarUrl: p.avatar_url as string | null,
      roleKeys: (p.role_keys as string[] | null) ?? [],
    }));
}
