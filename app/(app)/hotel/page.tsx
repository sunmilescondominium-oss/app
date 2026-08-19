import Link from "next/link";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import {
  listRoomBoard,
  listRatePlans,
  listPromos,
  listMenuItems,
  getGlobalTax,
  listRoomTax,
} from "@/lib/hotel/queries";
import { getActiveSession } from "@/lib/hotel/session";
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

  const [board, ratePlans, promos, menu, globalTax, roomTax, activeSession] = await Promise.all([
    listRoomBoard(),
    listRatePlans(),
    listPromos(),
    listMenuItems(),
    getGlobalTax(),
    listRoomTax(),
    getActiveSession(),
  ]);
  const occupied = board.filter((b) => b.stay).length;
  const isCashier    = userHasAnyRole(user, ["hotel_cashier"]);
  const isSupervisor = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant"]);
  const isOnDuty     = activeSession?.cashierUserId === user.userId;
  const hotelOpsLocked = !activeSession && isCashier && !isSupervisor;

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Hotel Ops"
        subtitle="Room board — check-in, live timers, orders, folio & receipts"
        badge={<Badge tone="amber">{occupied}/{board.length} occupied</Badge>}
      />

      {/* Cashier session banner */}
      {activeSession ? (
        <div className="no-print mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
          <span className="text-amber-900">
            🟢 <strong>{isOnDuty ? "You are" : activeSession.cashierName + " is"}</strong> on duty &nbsp;·&nbsp;
            <span className="text-amber-700 font-mono text-xs">Beginning AR: {activeSession.beginningArNo}</span>
          </span>
          <Link href="/hotel/shifts" className="text-xs font-semibold text-amber-700 hover:underline">
            Manage shift →
          </Link>
        </div>
      ) : (
        <div className={`no-print mb-4 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${
          hotelOpsLocked ? "border-rose-200 bg-rose-50" : "border-stone-200 bg-stone-50"
        }`}>
          <span className={hotelOpsLocked ? "text-rose-800" : "text-stone-600"}>
            {hotelOpsLocked
              ? "⚠ Hotel ops locked — open your shift to check in guests and process payments."
              : "⚪ No cashier on duty — hotel ops are locked for cashiers."}
          </span>
          {(isCashier || isSupervisor) && (
            <Link href="/hotel/shifts" className="text-xs font-semibold text-amber-700 hover:underline">
              Open shift →
            </Link>
          )}
        </div>
      )}

      <div className="no-print mb-4 flex flex-wrap items-center gap-4">
        <PushSubscribeButton label="Enable overdue alerts" />
        <Link href="/hotel/shifts" className="text-sm font-medium text-amber-700 hover:underline">
          Cashier shifts →
        </Link>
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
