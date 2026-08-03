import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { occupancyBoard, reminders } from "@/lib/rentals/queries";
import { peso } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Rentals & Airbnb" };

function fmtCheckout(mins: number | null): string {
  if (mins == null) return "";
  if (mins < 0) return `overdue ${Math.abs(mins)}m`;
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export default async function RentalsPage() {
  await requireModule("rentals");
  const board = await occupancyBoard();
  const rem = await reminders(board);

  return (
    <>
      <PageHeader
        backHref="/dashboard" title="Rentals & Airbnb" subtitle="Tap a unit to record dues, meter readings & manage the lease." />

      {rem.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Reminders</p>
          <div className="flex flex-wrap gap-2">
            {rem.map((r, i) => (
              <span key={i} className={`rounded-full px-3 py-1 text-xs font-medium ${r.tone === "red" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                {r.kind === "checkout" ? "🕒" : "₱"} {r.label} — {r.detail}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-amber-700/80">TODO: SMS / email reminders to tenants &amp; guests will be enabled next.</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {board.map((b) => {
          const occupied = Boolean(b.lease);
          const badge = occupied
            ? { text: "Occupied", cls: "bg-sky-100 text-sky-700" }
            : b.needsHousekeeping
              ? { text: "For Housekeeping", cls: "bg-amber-200 text-amber-900" }
              : { text: "Vacant", cls: "bg-emerald-100 text-emerald-800" };
          return (
            <Link
              key={b.unitId}
              href={`/rentals/${b.unitId}`}
              className={`rounded-2xl border-2 p-4 transition hover:shadow-sm ${b.checkoutSoon ? "border-amber-300 bg-amber-50" : occupied ? "border-sky-200 bg-white" : "border-stone-200 bg-white"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-stone-900">{b.unitNumber}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.text}</span>
              </div>
              <p className="mt-0.5 text-xs text-stone-400">{b.propertyName} · {b.businessLine}</p>
              {occupied ? (
                <p className="mt-2 truncate text-sm text-stone-700">{b.lease!.tenantLabel}</p>
              ) : (
                <p className="mt-2 text-sm text-stone-400">—</p>
              )}
              {b.businessLine === "airbnb" && b.lease?.endAt && (
                <p className={`mt-1 text-xs ${b.checkoutSoon ? "font-medium text-amber-700" : "text-stone-500"}`}>checkout {fmtCheckout(b.checkoutInMins)}</p>
              )}
              {b.nextDue && (
                <p className={`mt-1 text-xs ${b.nextDue.overdue ? "text-rose-700" : b.nextDue.dueSoon ? "text-amber-700" : "text-stone-500"}`}>
                  due {peso(b.nextDue.amount)} · {b.nextDue.dueDate}
                </p>
              )}
            </Link>
          );
        })}
        {board.length === 0 && <p className="text-sm text-stone-500">No rental or Airbnb units yet.</p>}
      </div>
    </>
  );
}
