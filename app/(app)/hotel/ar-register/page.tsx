import Link from "next/link";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { listARRegister } from "@/lib/hotel/ar-register";
import { ARRegisterTable } from "./ar-register-table";
import { todayManila } from "@/lib/collections/summary";

export const dynamic = "force-dynamic";
export const metadata = { title: "AR/OR Register" };

const ALLOWED = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting", "hotel_cashier"] as const;
const CAN_EDIT = ["admin", "managing_officer", "accounting", "consultant"] as const;

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const inputCls =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export default async function ARRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...ALLOWED]))
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;

  const sp = await searchParams;
  const date    = typeof sp.date    === "string" ? sp.date    : "";
  const arFrom  = typeof sp.ar_from === "string" ? sp.ar_from.trim() : "";
  const arTo    = typeof sp.ar_to   === "string" ? sp.ar_to.trim()   : "";
  const canEdit = userHasAnyRole(user, [...CAN_EDIT]);

  const hasArFilter = !!(arFrom || arTo);
  // Default to today only when no AR range is active
  const effectiveDate = date || (!hasArFilter ? todayManila() : "");

  const entries = await listARRegister({
    date:   effectiveDate || undefined,
    arFrom: arFrom || undefined,
    arTo:   arTo   || undefined,
  });

  const rangeTotal = entries.reduce((s, e) => s + e.amount, 0);
  const nonVoided  = entries.filter((e) => !e.voidedAsTest);
  const liveTotal  = nonVoided.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="AR / OR Register"
        subtitle="Hotel payments with Acknowledgment Receipt and Official Receipt tracking."
      />

      {/* Filter form */}
      <form method="GET" className="mb-5 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Date</label>
            <input
              type="date"
              name="date"
              defaultValue={effectiveDate}
              className={inputCls}
            />
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">AR From</label>
              <input
                type="text"
                name="ar_from"
                defaultValue={arFrom}
                placeholder="e.g. AR 205500"
                className={`${inputCls} w-36`}
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
                className={`${inputCls} w-36`}
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            View
          </button>
          {(hasArFilter || date) && (
            <a href="/hotel/ar-register" className="py-2 text-sm text-stone-500 hover:underline">
              Clear filters
            </a>
          )}
          <Link href="/hotel/shifts" className="ml-auto py-2 text-sm font-medium text-amber-700 hover:underline">
            Cashier shifts →
          </Link>
        </div>

        {hasArFilter && (
          <p className="mt-2 text-xs text-amber-700">
            AR range filter active — searching across the last 12 months
            {effectiveDate ? ` on ${effectiveDate}` : ""}.
          </p>
        )}
      </form>

      {/* AR range totals — shown when AR filter is active */}
      {hasArFilter && entries.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-500">Entries in range</p>
            <p className="text-lg font-bold tabular-nums text-stone-900">{entries.length}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-500">Total (incl. voided)</p>
            <p className="text-lg font-bold tabular-nums text-stone-900">{peso(rangeTotal)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">Live entries</p>
            <p className="text-lg font-bold tabular-nums text-emerald-800">{nonVoided.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">Live total</p>
            <p className="text-lg font-bold tabular-nums text-emerald-800">{peso(liveTotal)}</p>
          </div>
        </div>
      )}

      {canEdit && (
        <p className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          As accounting, you may correct AR/OR assignments by clicking <strong>Edit</strong> on any row. All changes are logged for audit.
        </p>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <ARRegisterTable entries={entries} canEdit={canEdit} />
        {/* Range total footer */}
        {entries.length > 0 && (
          <div className="mt-3 border-t border-stone-200 pt-3 flex items-center justify-between text-sm font-semibold text-stone-700">
            <span>{entries.length} payment{entries.length !== 1 ? "s" : ""}{hasArFilter ? ` (AR${arFrom ? ` from ${arFrom}` : ""}${arTo ? ` to ${arTo}` : ""})` : ""}</span>
            <span className="tabular-nums">{peso(rangeTotal)}</span>
          </div>
        )}
      </div>
    </>
  );
}
