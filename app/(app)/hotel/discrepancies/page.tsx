import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listDiscrepancies } from "@/lib/hotel/discrepancy-queries";
import { PageHeader, Badge } from "@/components/ui";
import { ResolveAlertButton } from "./resolve-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discrepancy Monitor" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function MinuteBadge({ minutes }: { minutes: number }) {
  const color =
    minutes > 60 ? "bg-red-100 text-red-800" :
    minutes > 30 ? "bg-amber-100 text-amber-800" :
    "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {minutes}m pending
    </span>
  );
}

const ALERT_LABELS: Record<string, string> = {
  additional_person: "Additional person at gate",
  unauthorized_entry: "Unauthorized entry",
  gate_query: "Gate query",
};

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  unacknowledged_transfer: { label: "Transfer not acknowledged by guard", color: "text-blue-800" },
  person_bypass: { label: "Authorized person — guard entry not confirmed", color: "text-amber-800" },
  entry_count_mismatch: { label: "Entry count mismatch", color: "text-rose-800" },
  unconfirmed_exit: { label: "Checkout — exit not confirmed by guard", color: "text-indigo-800" },
};

export default async function DiscrepanciesPage() {
  const user = await requireModule("hotel");
  const isSupervisor = user.roleKeys.some((r) =>
    ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"].includes(r),
  );

  const { alerts, discrepancies, totalIssues } = await listDiscrepancies();

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="Discrepancy Monitor"
        subtitle="Guard alerts and automated gate discrepancy flags — real-time"
        badge={
          totalIssues > 0 ? (
            <Badge tone="rose">{totalIssues} open</Badge>
          ) : (
            <Badge tone="green">All clear</Badge>
          )
        }
      />

      {totalIssues === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center text-sm text-emerald-700">
          ✓ No open discrepancies or unresolved guard alerts.
        </div>
      )}

      {/* Guard Alerts */}
      {alerts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-stone-700">
            Guard Alerts
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-normal text-rose-700">
              {alerts.length} unresolved
            </span>
          </h2>
          <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      a.alertType === "unauthorized_entry"
                        ? "bg-rose-100 text-rose-800"
                        : a.alertType === "additional_person"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-stone-100 text-stone-700"
                    }`}>
                      {ALERT_LABELS[a.alertType] ?? a.alertType}
                    </span>
                    <Link
                      href={`/hotel/${a.stayId}`}
                      className="text-sm font-medium text-stone-800 hover:underline"
                    >
                      Room {a.unitNumber} · {a.guestLabel}
                    </Link>
                  </div>
                  {a.message && (
                    <p className="mt-0.5 text-xs text-stone-500">{a.message}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-stone-400">
                    {a.raisedByName ? `Raised by ${a.raisedByName} · ` : ""}
                    {fmt(a.createdAt)}
                  </p>
                </div>
                {isSupervisor && (
                  <ResolveAlertButton alertId={a.id} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Computed Discrepancies */}
      {discrepancies.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">
            Automated Flags
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-700">
              {discrepancies.length} issue{discrepancies.length !== 1 ? "s" : ""}
            </span>
          </h2>
          <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden">
            {discrepancies.map((d, i) => {
              const meta = KIND_LABELS[d.kind];
              return (
                <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold ${meta?.color ?? "text-stone-700"}`}>
                      {meta?.label ?? d.kind}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/hotel/${d.stayId}`}
                        className="text-sm font-medium text-stone-800 hover:underline"
                      >
                        Room {d.unitNumber} · {d.guestLabel}
                      </Link>

                      {d.kind === "unacknowledged_transfer" && (
                        <>
                          <span className="text-xs text-stone-400">
                            from Room {d.fromUnit} at {fmt(d.transferredAt)}
                          </span>
                          <MinuteBadge minutes={d.minutesPending} />
                        </>
                      )}

                      {d.kind === "person_bypass" && (
                        <>
                          <span className="text-xs text-stone-400">
                            +{d.personCount} person{d.personCount !== 1 ? "s" : ""} — authorized at {fmt(d.authorizedAt)}
                          </span>
                          <MinuteBadge minutes={d.minutesPending} />
                        </>
                      )}

                      {d.kind === "entry_count_mismatch" && (
                        <span className="text-xs text-stone-400">
                          Declared {d.declaredCount} guest{d.declaredCount !== 1 ? "s" : ""} · guard confirmed {d.confirmedCount}
                        </span>
                      )}

                      {d.kind === "unconfirmed_exit" && (
                        <>
                          <span className="text-xs text-stone-400">
                            Checked out at {fmt(d.checkOutAt)}
                          </span>
                          <MinuteBadge minutes={d.minutesPending} />
                        </>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/hotel/${d.stayId}`}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 whitespace-nowrap"
                  >
                    View folio →
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-4 text-[11px] text-stone-400">
        This page refreshes on load. Use your browser&apos;s refresh or navigate back and return to see the latest state.
      </p>
    </>
  );
}
