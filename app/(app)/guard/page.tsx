import { requireModule } from "@/lib/auth/dal";
import { listGuardPosts, getActiveShift, listTodayEntrances, listOccupiedRoomsForGuard } from "@/lib/guard/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Badge } from "@/components/ui";
import { ShiftPanel } from "@/components/guard/shift-panel";
import { EntranceLogForm } from "@/components/guard/entrance-log-form";
import { EntranceLogList } from "@/components/guard/entrance-log-list";
import { HotelRoomBoard } from "@/components/guard/hotel-room-board";

export const metadata = { title: "Guard Post" };

export default async function GuardPage() {
  const user = await requireModule("guard");
  const admin = createAdminClient();
  const [posts, activeShift, flagRow] = await Promise.all([
    listGuardPosts(),
    getActiveShift(user.userId),
    admin.from("feature_flags").select("enabled").eq("key", "guard_hotel_view").maybeSingle(),
  ]);

  const hotelViewEnabled = flagRow.data?.enabled === true;
  const isHotelGate = activeShift?.postCode === "hotel_gate";

  const [entries, hotelRooms] = await Promise.all([
    activeShift ? listTodayEntrances(activeShift.postId) : Promise.resolve([]),
    hotelViewEnabled && isHotelGate && activeShift
      ? listOccupiedRoomsForGuard(activeShift.startedAt)
      : Promise.resolve([]),
  ]);

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

        {activeShift && hotelViewEnabled && isHotelGate && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-stone-700">
              Hotel room board
            </h2>
            <HotelRoomBoard
              initialRooms={hotelRooms}
              shiftStartedAt={activeShift.startedAt}
            />
          </div>
        )}

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
