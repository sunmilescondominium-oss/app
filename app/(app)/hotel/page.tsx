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
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import { CsvImporter } from "@/components/data/csv-importer";
import { RATE_PLAN_TEMPLATE, MENU_TEMPLATE } from "@/lib/imports/config";
import { bulkImportRatePlans, bulkImportMenu } from "@/app/(app)/hotel/actions";

export const metadata = { title: "Hotel Ops" };

export default async function HotelPage() {
  const user = await requireModule("hotel");
  const canWrite = canWriteModule(user.roleKeys, "hotel");
  // consultant is a SUPER_ROLE (bypasses module checks) but is not literally "admin",
  // so we include consultant explicitly in all hotel-config capability checks.
  const canManageConfig = user.roleKeys.some((r) => ["admin", "consultant"].includes(r));
  const canManageTax = user.roleKeys.some((r) => ["admin", "accounting", "consultant"].includes(r));

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
        backHref="/dashboard"
        title="Hotel Ops"
        subtitle="Room board — check-in, live timers, orders, folio & receipts"
        badge={<Badge tone="amber">{occupied}/{board.length} occupied</Badge>}
      />

      <div className="no-print mb-4 flex flex-wrap items-center gap-4">
        <PushSubscribeButton label="Enable overdue alerts" />
        <Link href="/hotel/day" className="text-sm font-medium text-amber-700 hover:underline">
          Day-end / remittance report →
        </Link>
        <Link href="/hotel/gift-cards" className="text-sm font-medium text-amber-700 hover:underline">
          Gift cards →
        </Link>
        {canManageConfig && (
          <>
            <CsvImporter title="Import rate plans from CSV" label="Import rate plans" templateName="rate_plans_template.csv" templateCsv={RATE_PLAN_TEMPLATE} requiredHeaders={["name", "base_rate"]} commit={bulkImportRatePlans} />
            <CsvImporter title="Import hotel menu from CSV" label="Import menu items" templateName="hotel_menu_template.csv" templateCsv={MENU_TEMPLATE} requiredHeaders={["category", "name", "price"]} commit={bulkImportMenu} />
          </>
        )}
      </div>

      {board.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
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
          canManageConfig={canManageConfig}
          canManageTax={canManageTax}
        />
      )}
    </>
  );
}
