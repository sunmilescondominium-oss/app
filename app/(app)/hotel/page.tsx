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
  listPendingGateEntries,
} from "@/lib/hotel/queries";
import { countOpenDiscrepancies } from "@/lib/hotel/discrepancy-queries";
import { getActiveSession, getSuggestedNextArNo } from "@/lib/hotel/session";
import { PageHeader, Badge } from "@/components/ui";
import { HotelBoard } from "@/components/hotel/hotel-board";
import { DemoModeBar } from "@/components/hotel/demo-mode-bar";
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
  const canManageExtraRates = user.roleKeys.some((r) => ["admin", "accounting", "hotel_rental_monitoring", "managing_officer", "consultant"].includes(r));

  const isDemoMode = Boolean(user.demoMode);
  const isCashier    = userHasAnyRole(user, ["hotel_cashier"]);
  const isSupervisor = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"]);
  const [board, ratePlans, promos, menu, globalTax, roomTax, activeSession, suggestedArNo, pendingGateEntries, openDiscrepancies] = await Promise.all([
    listRoomBoard(isDemoMode),
    listRatePlans(),
    listPromos(),
    listMenuItems(),
    getGlobalTax(),
    listRoomTax(),
    getActiveSession(),
    getSuggestedNextArNo(),
    listPendingGateEntries(),
    isSupervisor ? countOpenDiscrepancies() : Promise.resolve(0),
  ]);
  const occupied = board.filter((b) => b.stay).length;
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
            🟢 <strong>{isOnDuty ? "You are" : activeSession.cashierName + " is"}</strong>{" "}on duty &nbsp;·&nbsp;
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

      {/* Bagging-in-progress warning */}
      {activeSession && (() => {
        const st = activeSession.collectionStartsAt;
        const en = activeSession.collectionEndsAt;
        if (!st || !en) return null;
        const diffMs = new Date(en).getTime() - new Date(st).getTime();
        const stillOpen = new Date(en) > new Date();
        if (diffMs > 25 * 60 * 1000 || !stillOpen) return null;
        const cutoffLabel = new Date(en).toLocaleTimeString("en-PH", {
          timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit",
        });
        return (
          <div className="no-print mb-4 rounded-xl border border-amber-400 bg-amber-100 px-4 py-2.5 text-sm">
            <span className="font-semibold text-amber-900">⏱ Bagging in progress</span>
            <span className="ml-2 text-amber-800">
              New check-in payments after <strong>{cutoffLabel}</strong> will be collected by the next cashier.
            </span>
          </div>
        );
      })()}

      {/* Gate entry alert banner — shown to cashier when guard reports extra persons */}
      {pendingGateEntries.length > 0 && (
        <div className="no-print mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="mb-1.5 text-sm font-semibold text-rose-900">
            ⚠ {pendingGateEntries.reduce((s, e) => s + e.pendingCount, 0)} additional person{pendingGateEntries.reduce((s, e) => s + e.pendingCount, 0) !== 1 ? "s" : ""} waiting at gate — collect fee &amp; authorize entry
          </p>
          <ul className="flex flex-wrap gap-2">
            {pendingGateEntries.map((e) => (
              <li key={e.stayId}>
                <Link
                  href={`/hotel/${e.stayId}`}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-800 hover:bg-rose-200"
                >
                  Room {e.unitNumber} · {e.guestLabel}
                  {e.pendingCount > 0 && (
                    <span className="ml-1 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
                      +{e.pendingCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
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
        <Link href="/hotel/collection-report" className="text-sm font-medium text-amber-700 hover:underline">
          Room collection report →
        </Link>
        <Link href="/hotel/ar-register" className="text-sm font-medium text-amber-700 hover:underline">
          AR / OR register →
        </Link>
        <Link href="/hotel/gift-cards" className="text-sm font-medium text-amber-700 hover:underline">
          Gift cards →
        </Link>
        {isSupervisor && (
          <Link href="/hotel/transfers" className="text-sm font-medium text-amber-700 hover:underline">
            Room transfer log →
          </Link>
        )}
        {isSupervisor && (
          <Link
            href="/hotel/discrepancies"
            className={`inline-flex items-center gap-1.5 text-sm font-medium hover:underline ${
              openDiscrepancies > 0 ? "text-rose-700" : "text-amber-700"
            }`}
          >
            Discrepancy monitor
            {openDiscrepancies > 0 && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {openDiscrepancies}
              </span>
            )}
            →
          </Link>
        )}
        {canManageConfig && (
          <>
            <CsvImporter title="Import rate plans from CSV" label="Import rate plans" templateName="rate_plans_template.csv" templateCsv={RATE_PLAN_TEMPLATE} requiredHeaders={["name", "base_rate"]} commit={bulkImportRatePlans} />
            <CsvImporter title="Import hotel menu from CSV" label="Import menu items" templateName="hotel_menu_template.csv" templateCsv={MENU_TEMPLATE} requiredHeaders={["category", "name", "price"]} commit={bulkImportMenu} />
          </>
        )}
      </div>

      {user.demoMode && <DemoModeBar actingAs={user.actingAs} />}

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
          canManageExtraRates={canManageExtraRates}
          suggestedArNo={suggestedArNo}
        />
      )}
    </>
  );
}
