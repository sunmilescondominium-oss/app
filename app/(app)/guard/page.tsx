import Link from "next/link";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import {
  listGuardPosts, getActiveShift, listTodayEntrances, listOccupiedRoomsForGuard,
  getGuardProfile, getLastHandoverForPost,
} from "@/lib/guard/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Badge } from "@/components/ui";
import { ShiftPanel } from "@/components/guard/shift-panel";
import { EntranceLogForm } from "@/components/guard/entrance-log-form";
import { EntranceLogList } from "@/components/guard/entrance-log-list";
import { HotelRoomBoard } from "@/components/guard/hotel-room-board";
import { NdaGate } from "@/components/guard/nda-gate";

export const metadata = { title: "Guard Post" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric",
  });
}

export default async function GuardPage() {
  const user = await requireModule("guard");
  const admin = createAdminClient();

  const canManage = userHasAnyRole(user, ["admin", "managing_officer", "consultant"]);
  const [posts, activeShift, flagRow, profile] = await Promise.all([
    listGuardPosts(),
    getActiveShift(user.userId),
    admin.from("feature_flags").select("enabled").eq("key", "guard_hotel_view").maybeSingle(),
    getGuardProfile(user.userId),
  ]);

  // NDA gate — must acknowledge before accessing the portal
  if (!profile?.guardNdaAcknowledgedAt) {
    return (
      <>
        <PageHeader backHref="/dashboard" title="Guard Post" subtitle="Acknowledgment required" />
        <NdaGate />
      </>
    );
  }

  // Contract expiry block
  if (profile.isExpired) {
    return (
      <>
        <PageHeader backHref="/dashboard" title="Guard Post" subtitle="Account status" />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-lg font-bold text-rose-800">Access expired</p>
          <p className="mt-1 text-sm text-rose-700">
            Your guard account contract expired on{" "}
            <strong>{fmtDate(profile.guardContractExpiresAt!)}</strong>.
          </p>
          <p className="mt-2 text-xs text-rose-600">
            Contact the property management to renew your contract.
          </p>
        </div>
      </>
    );
  }

  const hotelViewEnabled = flagRow.data?.enabled === true;
  const isHotelGate = activeShift?.postCode === "hotel_gate";

  const [entries, hotelRooms, lastHandover] = await Promise.all([
    activeShift ? listTodayEntrances(activeShift.postId) : Promise.resolve([]),
    hotelViewEnabled && isHotelGate && activeShift
      ? listOccupiedRoomsForGuard(activeShift.startedAt)
      : Promise.resolve([]),
    !activeShift && posts.length > 0
      ? getLastHandoverForPost(posts[0].id)
      : Promise.resolve(null),
  ]);

  const stillInside = entries.filter((e) => !e.timeOut).length;

  // Contract expiry warning (within 7 days)
  const expiryWarning = profile.guardContractExpiresAt && !profile.isExpired
    ? (() => {
        const daysLeft = Math.ceil(
          (new Date(profile.guardContractExpiresAt).getTime() - Date.now()) / 86_400_000,
        );
        return daysLeft <= 7 ? daysLeft : null;
      })()
    : null;

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

      {canManage && (
        <div className="no-print mb-4 flex justify-end gap-4">
          <Link href="/guard/referrals" className="text-sm font-medium text-amber-700 hover:underline">
            Referral drivers →
          </Link>
          <Link href="/guard/accounts" className="text-sm font-medium text-amber-700 hover:underline">
            Guard accounts →
          </Link>
        </div>
      )}

      {expiryWarning !== null && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          ⚠ Your guard contract expires in <strong>{expiryWarning} day{expiryWarning !== 1 ? "s" : ""}</strong>. Contact management to renew.
        </div>
      )}

      <div className="space-y-4">
        <ShiftPanel posts={posts} activeShift={activeShift} lastHandover={lastHandover} />

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
