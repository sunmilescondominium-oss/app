import { requireModule } from "@/lib/auth/dal";
import { listGuardPosts, getActiveShift, listTodayEntrances } from "@/lib/guard/queries";
import { PageHeader, Badge } from "@/components/ui";
import { ShiftPanel } from "@/components/guard/shift-panel";
import { EntranceLogForm } from "@/components/guard/entrance-log-form";
import { EntranceLogList } from "@/components/guard/entrance-log-list";

export const metadata = { title: "Guard Post" };

export default async function GuardPage() {
  const user = await requireModule("guard");
  const [posts, activeShift] = await Promise.all([
    listGuardPosts(),
    getActiveShift(user.userId),
  ]);

  const entries = activeShift
    ? await listTodayEntrances(activeShift.postId)
    : [];

  const stillInside = entries.filter((e) => !e.timeOut).length;

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Guard Post"
        subtitle="Entrance log & shift management"
        badge={
          activeShift ? (
            <Badge tone={stillInside > 0 ? "amber" : "green"}>
              {stillInside} inside
            </Badge>
          ) : (
            <Badge tone="red">Off duty</Badge>
          )
        }
      />

      <div className="space-y-4">
        <ShiftPanel posts={posts} activeShift={activeShift} />

        {activeShift && (
          <>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-stone-700">
                Log an entry — {activeShift.postName}
              </h2>
              <EntranceLogForm hasActiveShift={true} />
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-stone-700">
                Today&apos;s log — {entries.length} entries
              </h2>
              <EntranceLogList entries={entries} />
            </div>
          </>
        )}

        {!activeShift && (
          <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
            Start your shift to begin logging entries.
          </div>
        )}
      </div>
    </>
  );
}
