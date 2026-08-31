import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { getMessages } from "@/lib/chat/queries";
import { getAllowedChatRoles } from "@/lib/chat/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { ThreadClient } from "@/components/chat/thread-client";

export const metadata = { title: "Messages" };

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: partnerId } = await params;
  const user = await requireModule("chat");

  // Validate that the current user is allowed to chat with this partner
  const allowedRoles = await getAllowedChatRoles(user.roleKeys as string[]);

  if (user.userId === partnerId) notFound();

  const admin = createAdminClient();
  const [{ data: partnerProfile }, { data: partnerRoleRows }] = await Promise.all([
    admin.from("profiles").select("id, display_label").eq("id", partnerId).maybeSingle(),
    admin.from("user_roles").select("role_key").eq("user_id", partnerId),
  ]);

  if (!partnerProfile) notFound();

  const partnerRoles: string[] = (partnerRoleRows ?? []).map((r) => r.role_key as string);
  const chatAllowed = partnerRoles.some((r) => allowedRoles.has(r));
  if (!chatAllowed) notFound();

  const initialMessages = await getMessages(user.userId, partnerId);

  return (
    <div className="space-y-3">
      <Link href="/chat" className="text-sm font-medium text-stone-400 hover:text-stone-600 hover:underline">
        ← All messages
      </Link>
      <ThreadClient
        myUserId={user.userId}
        partnerId={partnerId}
        partnerName={(partnerProfile.display_label as string) ?? "Unknown"}
        partnerRole={null}
        initialMessages={initialMessages}
      />
    </div>
  );
}
