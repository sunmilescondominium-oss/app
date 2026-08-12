import Link from "next/link";
import { requireAuth } from "@/lib/auth/dal";
import { listNotificationsForUser } from "@/lib/notifications/queries";
import { markRead, markAllRead } from "@/lib/notifications/actions";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ICONS: Record<string, string> = {
  transmittal_built: "📋",
  deposit_confirmed: "🏦",
};

export default async function NotificationsPage() {
  const user = await requireAuth();
  const notifs = await listNotificationsForUser(user.userId, user.roleKeys);
  const unread = notifs.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="flex items-center justify-between">
        <PageHeader
          title="Notifications"
          subtitle={unread > 0 ? `${unread} unread` : "All caught up"}
        />
        {unread > 0 && (
          <form action={markAllRead}>
            <button
              type="submit"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>

      <div className="mt-4 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {notifs.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-4xl">🔔</p>
            <p className="mt-3 text-sm font-medium text-stone-700">No notifications yet</p>
            <p className="mt-1 text-xs text-stone-400">Transmittal and deposit alerts will appear here.</p>
          </div>
        )}
        {notifs.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-5 py-4 transition ${!n.readAt ? "bg-amber-50/60" : ""}`}
          >
            <span className="mt-0.5 text-xl leading-none">
              {ICONS[n.kind] ?? "🔔"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-medium ${!n.readAt ? "text-stone-900" : "text-stone-600"}`}>
                  {n.link ? (
                    <Link href={n.link} className="hover:underline">{n.title}</Link>
                  ) : n.title}
                </p>
                <span className="shrink-0 text-xs text-stone-400">{timeAgo(n.createdAt)}</span>
              </div>
              {n.body && <p className="mt-0.5 text-xs text-stone-500">{n.body}</p>}
            </div>
            {!n.readAt && (
              <form action={markRead.bind(null, n.id)}>
                <button
                  type="submit"
                  className="shrink-0 rounded-full p-1 text-stone-400 hover:text-stone-700"
                  aria-label="Mark as read"
                  title="Mark as read"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
