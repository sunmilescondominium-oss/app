import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listHousekeepingTasks, listSupplies, listStockMovements } from "@/lib/housekeeping/queries";
import { HOUSEKEEPING_STATUSES } from "@/lib/config";
import { PageHeader, Badge } from "@/components/ui";
import { SuppliesPanel } from "@/components/housekeeping/supplies-panel";
import { StockMovementsPanel } from "@/components/housekeeping/stock-movements";

export const metadata = { title: "Housekeeping" };

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-emerald-100 text-emerald-800",
};
const STATUS_LABEL = Object.fromEntries(HOUSEKEEPING_STATUSES.map((s) => [s.key, s.label]));

export default async function HousekeepingPage() {
  const user = await requireModule("housekeeping");
  const canManageSupplies = user.roleKeys.some((r) => ["admin", "operations_manager"].includes(r));

  const [tasks, supplies, movements] = await Promise.all([listHousekeepingTasks(), listSupplies(), listStockMovements()]);
  const toClean = tasks.filter((t) => t.status !== "done").length;

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Housekeeping"
        subtitle="Room cleaning, turnover & supplies"
        badge={<Badge tone={toClean > 0 ? "amber" : "green"}>{toClean} to clean</Badge>}
      />

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Since</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                  No housekeeping tasks. They appear automatically when a guest checks out.
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
                    {STATUS_LABEL[t.status] ?? t.status}
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

      <SuppliesPanel supplies={supplies} canManage={canManageSupplies} />

      <StockMovementsPanel supplies={supplies} movements={movements} canManage={canManageSupplies} />
    </>
  );
}
