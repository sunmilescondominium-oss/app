import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { listHousekeepingTasks, listSupplies, listStockMovements } from "@/lib/housekeeping/queries";
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

export const metadata = { title: "Housekeeping" };

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-emerald-100 text-emerald-800",
};
const STATUS_KEY: Record<string, string> = { pending: "hk_st_pending", in_progress: "hk_st_in_progress", done: "hk_st_done" };

export default async function HousekeepingPage() {
  const user = await requireModule("housekeeping");
  const lang = await getLang();
  const canManageSupplies = user.roleKeys.some((r) => ["admin", "operations_manager"].includes(r));

  const today = todayManila();
  const [tasks, supplies, movements, countPhotos] = await Promise.all([
    listHousekeepingTasks(), listSupplies(), listStockMovements(), listDocPhotos("stock_count", today),
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

      <div className="table-wrap">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">{tt(lang, "hk_room")}</th>
              <th className="px-4 py-3">{tt(lang, "col_status")}</th>
              <th className="px-4 py-3">{tt(lang, "hk_shift")}</th>
              <th className="px-4 py-3">{tt(lang, "hk_assigned")}</th>
              <th className="px-4 py-3">{tt(lang, "hk_since")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                  {tt(lang, "hk_no_tasks")}
                </td>
              </tr>
            )}
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-3 font-medium text-stone-900">
                  <Link href={`/housekeeping/${t.id}`} className="text-amber-700 hover:underline">
                    {t.unit_number ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[t.status] ?? ""}`}>
                    {tt(lang, STATUS_KEY[t.status] ?? "")}
                  </span>
                </td>
                <td className="px-4 py-3 capitalize">{t.shift ?? "—"}</td>
                <td className="px-4 py-3">{t.assigned_to_role ? t.assigned_to_role.replace(/_/g, " ") : "—"}</td>
                <td className="px-4 py-3 text-stone-500">{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManageSupplies && (
        <div className="mt-6">
          <CsvImporter title="Import supplies from CSV" templateName="room_supplies_template.csv" templateCsv={SUPPLY_TEMPLATE} requiredHeaders={["name"]} commit={bulkImportSupplies} />
        </div>
      )}

      <SuppliesPanel supplies={supplies} canManage={canManageSupplies} />

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
