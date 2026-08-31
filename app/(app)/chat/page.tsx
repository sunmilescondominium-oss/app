import { requireModule } from "@/lib/auth/dal";
import { listConversations } from "@/lib/chat/queries";
import { getMyChattableStaff } from "@/lib/chat/actions";
import { InboxClient } from "@/components/chat/inbox-client";

export const metadata = { title: "Messages" };

export default async function ChatPage() {
  const user = await requireModule("chat");

  const [conversations, chattableStaff] = await Promise.all([
    listConversations(user.userId),
    getMyChattableStaff(),
  ]);

  return (
    <InboxClient
      myUserId={user.userId}
      initialConversations={conversations}
      chattableStaff={chattableStaff}
    />
  );
}
