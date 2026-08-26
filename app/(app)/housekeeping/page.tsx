import { requireModule } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { listHousekeepingTasks, listSupplies, listStockMovements, listOccupiedRooms, listRoomTypes } from "@/lib/housekeeping/queries";
import { getShiftEndToday } from "@/lib/housekeeping/shift";
import { AttendantBoard } from "@/components/housekeeping/attendant-board";
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import { RoomTypeSettings } from "@/components/housekeeping/room-type-settings";
import { PageHeader, Badge } from "@/components/ui";
import { SuppliesPanel } from "@/components/housekeeping/supplies-panel";
import { StockMovementsPanel } from "@/components/housekeeping/stock-movements";
import { CsvImporter } from "@/components/data/csv-importer";
import { SUPPLY_TEMPLATE } from "@/lib/imports/config";
import { bulkImportSupplies } from "@/app/(app)/housekeeping/actions";
import { HelpPanel } from "@/components/guide/help";
import { listDocPhotos } from "@/lib/docs/photos";
import { PhotoDocPanel } from "@/components/capture/photo-doc-panel";
import { todayManila } from "@/lib/collections/summary";
import { getLang } from "@/lib/i18n-server";
import { t as tt } from "@/lib/i18n";
import { isHousekeepingHardStop } from "@/lib/settings/flags";

export const metadata = { title: "Housekeeping" };

export default async function HousekeepingPage() {
  const user = await requireModule("housekeeping");
  const lang = await getLang();
  const canManageSupplies = user.roleKeys.some((r) => ["admin", "operations_manager"].includes(r));
  const canSetDefaults = user.roleKeys.some((r) => ["admin", "operations_manager", "hotel_rental_monitoring"].includes(r));

  const today = todayManila();
  const isDemoMode = Boolean(user.demoMode);
  const [tasks, supplies, movements, countPhotos, hardStop, occupied, shiftEnd, roomTypes] = await Promise.all([
    listHousekeepingTasks(isDemoMode), listSupplies(), listStockMovements(), listDocPhotos("stock_count", today), isHousekeepingHardStop(),
    listOccupiedRooms(isDemoMode), getShiftEndToday(user.userId), listRoomTypes(),
  ]);
  const toClean = tasks.filter((t) => t.status !== "done").length;

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title={tt(lang, "hk_title")}
        subtitle={tt(lang, "hk_sub")}
        badge={<Badge tone={toClean > 0 ? "amber" : "green"}>{toClean} {tt(lang, "hk_to_clean")}</Badge>}
      />

      <HelpPanel
        title={tt(lang, "hk_help_title")}
        steps={[
          tt(lang, "hk_help_1"),
          tt(lang, "hk_help_2"),
          tt(lang, "hk_help_3"),
        ]}
      />

      <div className="mb-3">
        <PushSubscribeButton label="Enable cleaning SLA alerts" />
      </div>
      <AttendantBoard tasks={tasks} occupied={occupied} shiftEndIso={shiftEnd} lang={lang} />

      {canSetDefaults && <RoomTypeSettings roomTypes={roomTypes} lang={lang} />}

      {canManageSupplies && (
        <div className="mt-6">
          <CsvImporter title="Import supplies from CSV" templateName="room_supplies_template.csv" templateCsv={SUPPLY_TEMPLATE} requiredHeaders={["name"]} commit={bulkImportSupplies} />
        </div>
      )}

      <SuppliesPanel supplies={supplies} canManage={canManageSupplies} canSetDefaults={canSetDefaults} hardStop={hardStop} lang={lang} />

      <StockMovementsPanel supplies={supplies} movements={movements} canManage={canManageSupplies} />

      <div className="mt-6">
        <PhotoDocPanel
          entity="stock_count"
          entityId={today}
          kind="count"
          title={`Physical count evidence — ${today}`}
          label={`Inventory count · ${today}`}
          canWrite={canManageSupplies}
          canView={canReadModule(user.roleKeys, "media")}
          photos={countPhotos}
        />
      </div>
    </>
  );
}
