import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import {
  listRoomBoard,
  listRatePlans,
  listPromos,
  listMenuItems,
  getGlobalTax,
  listRoomTax,
} from "@/lib/hotel/queries";
import { PageHeader, Badge } from "@/components/ui";
import { HotelBoard } from "@/components/hotel/hotel-board";

export const metadata = { title: "Hotel Ops" };

export default async function HotelPage() {
  const user = await requireModule("hotel");
  const canWrite = canWriteModule(user.roleKeys, "hotel");
  const isAdmin = user.roleKeys.includes("admin");
  const canManageTax = user.roleKeys.some((r) => ["admin", "accounting"].includes(r));

  const [board, ratePlans, promos, menu, globalTax, roomTax] = await Promise.all([
    listRoomBoard(),
    listRatePlans(),
    listPromos(),
    listMenuItems(),
    getGlobalTax(),
    listRoomTax(),
  ]);
  const occupied = board.filter((b) => b.stay).length;

  return (
    <>
      <PageHeader
        title="Hotel Ops"
        subtitle="Room board — check-in, live timers, orders, folio & receipts"
        badge={<Badge tone="amber">{occupied}/{board.length} occupied</Badge>}
      />

      <div className="no-print mb-4">
        <Link href="/hotel/day" className="text-sm font-medium text-amber-700 hover:underline">
          Day-end / remittance report →
        </Link>
      </div>

      {board.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No hotel rooms yet. Add rooms in Inventory with business line = Hotel.
        </div>
      ) : (
        <HotelBoard
          board={board}
          ratePlans={ratePlans}
          promos={promos}
          menu={menu}
          globalTax={globalTax}
          roomTax={roomTax}
          canWrite={canWrite}
          isAdmin={isAdmin}
          canManageTax={canManageTax}
        />
      )}
    </>
  );
}
