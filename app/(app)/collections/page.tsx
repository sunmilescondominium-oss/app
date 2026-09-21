import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule, canEditCollections } from "@/lib/rbac/modules";
import { listCollections, listUnitOptions, listDeletedCollections } from "@/lib/collections/queries";
import { getBankNameMap, getBankItemsMap } from "@/lib/collections/bank-config";
import { getActiveItemTypes } from "@/lib/collections/item-types";
import { summarizeCollections, peso, todayManila } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader, Badge } from "@/components/ui";
import { FloatingCalculator } from "@/components/ui/floating-calculator";
import { CollectionsPanel } from "@/components/collections/collections-panel";
import { DeletedCollectionsPanel } from "@/components/collections/deleted-records-panel";
import { restoreCollection, purgeCollection } from "./actions";

export const metadata = { title: "Collections" };

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("collections");
  const canWrite = canWriteModule(user.roleKeys, "collections");
  const canEdit = canEditCollections(user.roleKeys);
  const isConsultant = user.allRoleKeys.includes("consultant");
  const canSeeARRegister = user.roleKeys.some((r) =>
    ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting", "hotel_cashier"].includes(r),
  );
  const canClearChecks = user.roleKeys.some((r) =>
    ["accounting", "managing_officer", "consultant", "admin"].includes(r),
  );
  const canRestore = user.allRoleKeys.some((r) =>
    ["admin", "managing_officer", "consultant", "accounting"].includes(r),
  );

  const sp = await searchParams;
  const date   = (typeof sp.date    === "string" && sp.date)    || todayManila();
  const arFrom = typeof sp.ar_from  === "string" ? sp.ar_from.trim()  : "";
  const arTo   = typeof sp.ar_to    === "string" ? sp.ar_to.trim()    : "";
  const orNo   = typeof sp.or_no    === "string" ? sp.or_no.trim()    : "";
  const hasArFilter  = !!(arFrom || arTo);
  const hasOrFilter  = !!orNo;
  const hasAnyFilter = hasArFilter || hasOrFilter;

  // When AR filter is active, search across last 365 days (not just today)
  const queryDate = hasArFilter ? undefined : date;

  const [collections, unitOptions, itemTypes, bankMap, bankItemsMap, deletedCollections] = await Promise.all([
    listCollections({
      date:   queryDate,
      arFrom: arFrom || undefined,
      arTo:   arTo   || undefined,
      orNo:   orNo   || undefined,
    }),
    canWrite ? listUnitOptions() : Promise.resolve([]),
    getActiveItemTypes(),
    getBankNameMap(),
    getBankItemsMap(),
    canRestore ? listDeletedCollections() : Promise.resolve([]),
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

      {/* Date + AR + Receipt# filter */}
      <form
        method="get"
        className="no-print mb-4 rounded-2xl border border-stone-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Date</label>
            <input type="date" name="date" defaultValue={date} className={inputCls} />
          </div>

          {/* AR range */}
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">AR From</label>
              <input
                type="text"
                name="ar_from"
                defaultValue={arFrom}
                placeholder="e.g. AR 205500"
                className={`${inputCls} w-32`}
              />
            </div>
            <span className="pb-2.5 text-stone-400">—</span>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">AR To</label>
              <input
                type="text"
                name="ar_to"
                defaultValue={arTo}
                placeholder="e.g. AR 205600"
                className={`${inputCls} w-32`}
              />
            </div>
          </div>

          {/* Receipt # */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Receipt #</label>
            <input
              type="text"
              name="or_no"
              defaultValue={orNo}
              placeholder="e.g. 205580"
              className={`${inputCls} w-28`}
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            View
          </button>
          {hasAnyFilter && (
            <a href={`/collections?date=${date}`} className="py-2 text-sm text-stone-500 hover:underline">
              Clear filters
            </a>
          )}
          <a href={`/api/export/collections?date=${date}`} className="ml-auto rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
            ⬇ Export to Sheets
          </a>
          {canSeeARRegister && (
            <Link
              href={`/hotel/collection-report?date=${date}`}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            >
              🧾 Hotel room report →
            </Link>
          )}
          {canWrite && (
            <Link href="/admin/rate-cards" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100">
              Rate cards
            </Link>
          )}
        </div>
        {(hasArFilter || hasOrFilter) && (
          <p className="mt-2 text-xs text-amber-700">
            {[
              hasArFilter && `AR range: ${arFrom || "—"} – ${arTo || "—"} (last 12 months)`,
              hasOrFilter && `Receipt #: "${orNo}"`,
            ].filter(Boolean).join(" · ")}
          </p>
        )}
      </form>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`rounded-xl border px-4 py-3 ${hasAnyFilter ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"}`}>
          <p className={`text-2xl font-bold tabular-nums ${hasAnyFilter ? "text-emerald-800" : "text-stone-900"}`}>{peso(summary.grandTotal)}</p>
          <p className={`text-xs ${hasAnyFilter ? "text-emerald-700" : "text-stone-500"}`}>
            {hasAnyFilter ? "Filtered total" : "Grand total"}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums text-stone-900">{summary.count}</p>
          <p className="text-xs text-stone-500">Entries{hasAnyFilter ? " (filtered)" : ""}</p>
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
                  No collections for {hasAnyFilter ? "the current filter" : "this date"}.
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
        canWrite={canWrite && !hasAnyFilter}
        canEdit={canEdit && !hasAnyFilter}
        canClearChecks={canClearChecks}
        isConsultant={isConsultant}
        date={date}
      />

      {!canWrite && (
        <p className="mt-4 text-xs text-stone-400">You have view-only access to collections.</p>
      )}

      {canRestore && deletedCollections.length > 0 && (
        <DeletedCollectionsPanel
          items={deletedCollections}
          canRestore={canRestore}
          canPurge={isConsultant}
          onRestore={restoreCollection}
          onPurge={purgeCollection}
        />
      )}
      <FloatingCalculator />
    </>
  );
}
