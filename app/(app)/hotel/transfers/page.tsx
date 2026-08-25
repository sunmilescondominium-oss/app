import Link from "next/link";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { listRoomTransfers } from "@/lib/hotel/queries";
import { getAppTimezone } from "@/lib/settings/app-settings";
import { fmtDateTime } from "@/lib/collections/summary";
import { PageHeader, Badge } from "@/components/ui";

export const metadata = { title: "Room Transfer Log" };

const REASON_LABEL: Record<string, string> = {
  room_issue: "Room issue",
  maintenance: "Maintenance / repair",
  guest_preference: "Guest preference",
  other: "Other",
};

export default async function RoomTransfersPage() {
  const user = await requireModule("hotel");
  const canView = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "accounting", "consultant"]);
  if (!canView) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        Access restricted — accounting, admin, or hotel monitoring only.
      </div>
    );
  }

  const [transfers, tz] = await Promise.all([listRoomTransfers({ limit: 100 }), getAppTimezone()]);

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="Room Transfer Log"
        subtitle="Audit record of all guest room transfers — reviewed by accounting, admin, and hotel monitoring"
        badge={<Badge tone="amber">{transfers.length} record{transfers.length !== 1 ? "s" : ""}</Badge>}
      />

      {transfers.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
          No room transfers recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">From room</th>
                <th className="px-4 py-3">To room</th>
                <th className="px-4 py-3">Timer</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3">Done by</th>
                <th className="px-4 py-3">Folio links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-700 whitespace-nowrap">
                    {fmtDateTime(t.transferred_at, tz)}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">
                    Room {t.from_unit_number}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">
                    Room {t.to_unit_number}
                  </td>
                  <td className="px-4 py-3">
                    {t.within_10_min ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        ≤10 min — reset
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        &gt;10 min — +5 min
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-700">
                    {REASON_LABEL[t.transfer_reason] ?? t.transfer_reason}
                  </td>
                  <td className="px-4 py-3 text-stone-600 max-w-xs">
                    {t.remarks ?? <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-stone-700">
                    {t.performer_name ?? <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs space-y-0.5">
                    <div>
                      <Link href={`/hotel/${t.from_stay_id}`} className="text-amber-700 hover:underline">
                        Original stay →
                      </Link>
                    </div>
                    {t.to_stay_id && (
                      <div>
                        <Link href={`/hotel/${t.to_stay_id}`} className="text-amber-700 hover:underline">
                          New stay →
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
