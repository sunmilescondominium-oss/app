import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule, canEditCollections } from "@/lib/rbac/modules";
import { listCollections, listUnitOptions } from "@/lib/collections/queries";
import { getBankNameMap, getBankItemsMap } from "@/lib/collections/bank-config";
import { getActiveItemTypes } from "@/lib/collections/item-types";
import { summarizeCollections, peso, todayManila } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader, Badge } from "@/components/ui";
import { CollectionsPanel } from "@/components/collections/collections-panel";

export const metadata = { title: "Collections" };

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("collections");
  const canWrite = canWriteModule(user.roleKeys, "collections");
  const canEdit = canEditCollections(user.roleKeys);
  const isConsultant = user.roleKeys.includes("consultant");
  const canClearChecks = user.roleKeys.some((r) =>
    ["accounting", "managing_officer", "consultant", "admin"].includes(r),
  );

  const sp = await searchParams;
  const date = (typeof sp.date === "string" && sp.date) || todayManila();

  const [collections, unitOptions, itemTypes, bankMap, bankItemsMap] = await Promise.all([
    listCollections(date),
    canWrite ? listUnitOptions() : Promise.resolve([]),
    getActiveItemTypes(),
    getBankNameMap(),
    getBankItemsMap(),
  ]);
  const summary = summarizeCollections(date, collections);

  const inputCls =
    "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Collections"
        subtitle="Daily collections — digital record & printable report"
        badge={<Badge tone="green">Live</Badge>}
      />

      {/* Print-only report header (paper trail) */}
      <div className="mb-4 hidden print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Daily Collections Report — {date}</p>
      </div>

      {/* Date filter */}
      <form
        method="get"
        className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Date</label>
          <input type="date" name="date" defaultValue={date} className={inputCls} />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
        >
          View
        </button>
        <a href={`/api/export/collections?date=${date}`} className="ml-auto rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
          ⬇ Export to Sheets
        </a>
        {canWrite && (
          <Link href="/admin/rate-cards" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100">
            Rate cards
          </Link>
        )}
      </form>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-stone-900">{peso(summary.grandTotal)}</p>
          <p className="text-xs text-stone-500">Grand total</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-stone-900">{summary.count}</p>
          <p className="text-xs text-stone-500">Entries</p>
        </div>
      </div>

      <div className="mb-6 table-wrap">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Entries</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-stone-500">
                  No collections for this date.
                </td>
              </tr>
            )}
            {summary.rows.map((r) => (
              <tr key={r.category} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{r.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-semibold">
              <td className="px-4 py-3">Grand total</td>
              <td className="px-4 py-3 text-right tabular-nums">{summary.count}</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(summary.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <CollectionsPanel
        collections={collections}
        unitOptions={unitOptions}
        itemTypes={itemTypes}
        bankMap={bankMap}
        bankItemsMap={bankItemsMap}
        canWrite={canWrite}
        canEdit={canEdit}
        canClearChecks={canClearChecks}
        isConsultant={isConsultant}
        date={date}
      />

      {!canWrite && (
        <p className="mt-4 text-xs text-stone-400">You have view-only access to collections.</p>
      )}
    </>
  );
}
