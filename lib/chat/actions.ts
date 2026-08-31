"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { canChat, setChatPermission } from "@/lib/chat/permissions";
import { getChattableStaff } from "@/lib/chat/queries";
import { createNotification } from "@/lib/notifications/queries";

const SUPER = ["admin", "managing_officer", "consultant"];

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Send a message. Validates role permission before inserting. */
export async function sendMessage(recipientId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 2000) return { ok: false, error: "Invalid message." };

  const user = await requireAuth();
  if (user.userId === recipientId) return { ok: false, error: "Cannot message yourself." };

  // Check role permission — any of sender's roles must be allowed to chat with any recipient role
  const admin = createAdminClient();
  const { data: recipientRoleRows } = await admin
    .from("user_roles")
    .select("role_key")
    .eq("user_id", recipientId);

  const recipientRoles: string[] = (recipientRoleRows ?? []).map((r) => r.role_key as string);
  if (recipientRoles.length === 0) return { ok: false, error: "Recipient not found." };

  const senderRoles = user.roleKeys as string[];
  let allowed = false;
  for (const sr of senderRoles) {
    for (const rr of recipientRoles) {
      if (sr === rr) continue;
      if (await canChat(sr, rr)) { allowed = true; break; }
    }
    if (allowed) break;
  }
  if (!allowed) return { ok: false, error: "You are not permitted to message this person." };

  const { error } = await admin.from("chat_messages").insert({
    sender_id: user.userId,
    recipient_id: recipientId,
    body: trimmed,
  });
  if (error) return { ok: false, error: error.message };

  // Fire a bell notification to the recipient if they have no recent unread from sender
  const { count } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.userId)
    .eq("recipient_id", recipientId)
    .is("read_at", null)
    .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString());

  if ((count ?? 0) <= 1) {
    await createNotification({
      kind: "chat",
      title: `Message from ${user.displayLabel}`,
      body: trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed,
      link: `/chat/${user.userId}`,
      entityType: "chat",
      entityId: user.userId,
      recipientUserId: recipientId,
      createdBy: user.userId,
    });
  }

  return { ok: true };
}

/** Mark all unread messages from a conversation as read. */
export async function markRead(senderId: string): Promise<void> {
  const user = await requireAuth();
  const admin = createAdminClient();
  await admin
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", senderId)
    .eq("recipient_id", user.userId)
    .is("read_at", null);
  revalidatePath("/chat");
}

/** Toggle a role-pair chat permission (super only). */
export async function toggleChatPermission(
  roleA: string,
  roleB: string,
  enabled: boolean,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!user.roleKeys.some((r) => SUPER.includes(r as string))) {
    return { ok: false, error: "Unauthorized." };
  }
  const { error } = await setChatPermission(roleA, roleB, enabled);
  if (error) return { ok: false, error };
  revalidatePath("/admin/chat-permissions");
  return { ok: true };
}

/** Get all staff the current user is allowed to chat with. */
export async function getMyChattableStaff() {
  const user = await requireAuth();
  const { getAllowedChatRoles } = await import("@/lib/chat/permissions");
  const allowedRoles = await getAllowedChatRoles(user.roleKeys as string[]);
  return getChattableStaff(Array.from(allowedRoles), user.userId);
}
