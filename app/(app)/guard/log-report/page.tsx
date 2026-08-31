import Link from "next/link";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { listGuardPosts, listEntranceLogReport } from "@/lib/guard/queries";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Guard Log Report" };

const ENTRY_ICONS: Record<string, string> = {
  guest: "🛎", vehicle: "🚗", visitor: "👤", delivery: "📦",
  staff: "🪪", unit_owner: "🏠", renter: "🔑", other: "⋯",
};

const ENTRY_LABELS: Record<string, string> = {
  guest: "Hotel Guest", vehicle: "Vehicle", visitor: "Visitor", delivery: "Delivery",
  staff: "Staff", unit_owner: "Unit Owner", renter: "Renter / Tenant", other: "Other",
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric",
  });
}

function todayManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export default async function GuardLogReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; post?: string }>;
}) {
  const user = await requireModule("guard");
  const canView = userHasAnyRole(user, [
    "guard", "admin", "managing_officer", "consultant", "accounting",
    "hotel_rental_monitoring",
  ]);
  if (!canView) throw new Error("Access denied.");

  const sp = await searchParams;
  const date = sp.date || todayManila();
  const postId = sp.post || null;

  const [posts, entries] = await Promise.all([
    listGuardPosts(),
    listEntranceLogReport(date, postId),
  ]);

  const stillInside = entries.filter((e) => !e.timeOut).length;
  const byType = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.entryType] = (acc[e.entryType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Guard Log Report"
        subtitle={`Entry and exit log · ${fmtDate(date + "T00:00:00+08:00")}`}
        backHref="/guard"
      />

      {/* Filters */}
      <form method="get" className="no-print mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Post</label>
          <select
            name="post"
            defaultValue={postId ?? ""}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          >
            <option value="">All posts</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          View →
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Print
        </button>
      </form>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-stone-900">{entries.length}</p>
          <p className="text-xs text-stone-500">Total entries</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-800">{stillInside}</p>
          <p className="text-xs text-emerald-700">Still inside</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-stone-900">{entries.length - stillInside}</p>
          <p className="text-xs text-stone-500">Exited</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-stone-900">
            {entries.filter((e) => e.plateNumber).length}
          </p>
          <p className="text-xs text-stone-500">Vehicles</p>
        </div>
      </div>

      {/* Type breakdown */}
      {Object.keys(byType).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, count]) => (
            <span
              key={type}
              className="flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700"
            >
              {ENTRY_ICONS[type] ?? "⋯"} {ENTRY_LABELS[type] ?? type}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Log entries */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-400">
          No entries logged for this date{postId ? " at this post" : ""}.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className={`rounded-xl border bg-white p-3 ${e.timeOut ? "" : "border-emerald-200 bg-emerald-50/30"}`}
            >
              <div className="flex items-start gap-3">
                {/* Time column */}
                <div className="w-20 shrink-0 text-center">
                  <p className="font-mono text-xs font-semibold text-stone-700">{fmtTime(e.timeIn)}</p>
                  <p className="text-[10px] text-stone-400">in</p>
                  {e.timeOut ? (
                    <>
                      <p className="mt-0.5 font-mono text-xs text-stone-400">{fmtTime(e.timeOut)}</p>
                      <p className="text-[10px] text-stone-400">out</p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">inside</p>
                  )}
                </div>

                {/* Main info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">
                      {ENTRY_ICONS[e.entryType] ?? "⋯"}
                    </span>
                    <span className="text-xs font-semibold text-stone-600">
                      {ENTRY_LABELS[e.entryType] ?? e.entryType}
                    </span>
                    {e.destinationUnit && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        → {e.destinationUnit}
                      </span>
                    )}
                    {e.postName && (
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                        {e.postName}
                      </span>
                    )}
                    {e.shiftType && (
                      <span className="text-[10px] text-stone-400 capitalize">{e.shiftType} shift</span>
                    )}
                  </div>
                  {e.visitorName && (
                    <p className="mt-0.5 text-sm font-medium text-stone-800">{e.visitorName}</p>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0 text-xs text-stone-500">
                    {e.plateNumber && (
                      <span className="font-mono font-semibold">{e.plateNumber}</span>
                    )}
                    {e.vehicleType && <span className="capitalize">{e.vehicleType}</span>}
                    {e.passengerCount != null && <span>{e.passengerCount} pax</span>}
                    {e.driverName && <span>Driver: {e.driverName}</span>}
                    {e.notes && <span className="italic">"{e.notes}"</span>}
                  </div>
                  {/* Future stubs */}
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-stone-300">
                    <span>📷 ID photo: —</span>
                    <span>✍️ Signature: —</span>
                    <span className="text-stone-400">By {e.loggedByLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print footer */}
      <div className="print-only mt-8 border-t border-stone-300 pt-4 text-xs text-stone-500">
        <p>Guard Log Report · {fmtDate(date + "T00:00:00+08:00")} · Printed {new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
        <p className="mt-4">Verified by: _________________________________ Date: _____________</p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>
    </>
  );
}
