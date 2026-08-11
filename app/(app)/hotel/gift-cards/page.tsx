import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listGiftCards, listPendingLoadRequests, listPendingReservationsForDate } from "@/lib/gift-cards/queries";
import { PageHeader, Badge } from "@/components/ui";
import { CreateGiftCardForm } from "@/components/hotel/gift-cards/create-gift-card-form";
import { LoadRequestRow } from "@/components/hotel/gift-cards/load-request-row";
import { ReservationRow } from "@/components/hotel/gift-cards/reservation-row";

function formatHours(h: number) {
  return h === 1 ? "1 hr" : `${h} hrs`;
}

export const metadata = { title: "Gift Cards — Hotel" };

function manilaDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export default async function GiftCardsPage() {
  const user = await requireModule("hotel");
  const canManageConfig = user.roleKeys.some((r) => ["admin", "consultant"].includes(r));
  const canWrite = canWriteModule(user.roleKeys, "hotel");

  const today = manilaDate();
  const [cards, loadRequests, todayResvs] = await Promise.all([
    listGiftCards(),
    listPendingLoadRequests(),
    listPendingReservationsForDate(today),
  ]);

  const active = cards.filter((c) => c.is_active);
  const inactive = cards.filter((c) => !c.is_active);

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="Gift Cards"
        subtitle="Prepaid hour-balance cards for hotel guests"
        badge={<Badge tone="amber">{active.length} active</Badge>}
      />

      <div className="space-y-8">
        {/* ── Today's pre-scheduled check-ins ── */}
        {todayResvs.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-stone-600 uppercase tracking-wide">
              Today&apos;s reservations ({today})
            </h2>
            <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {todayResvs.map((r) => (
                <ReservationRow key={r.id} reservation={r} canWrite={canWrite} />
              ))}
            </div>
          </section>
        )}

        {/* ── Pending load requests ── */}
        {loadRequests.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-stone-600 uppercase tracking-wide">
              Pending load requests ({loadRequests.length})
            </h2>
            <div className="divide-y divide-stone-100 rounded-2xl border border-amber-200 bg-amber-50">
              {loadRequests.map((r) => (
                <LoadRequestRow key={r.id} request={r} canApprove={canManageConfig} />
              ))}
            </div>
          </section>
        )}

        {/* ── Sell new card ── */}
        {canWrite && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-stone-600 uppercase tracking-wide">Sell a new gift card</h2>
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <CreateGiftCardForm />
            </div>
          </section>
        )}

        {/* ── Active cards ── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-stone-600 uppercase tracking-wide">Active cards ({active.length})</h2>
          {active.length === 0 ? (
            <p className="text-sm text-stone-400">No active gift cards.</p>
          ) : (
            <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {active.map((c) => (
                <Link key={c.id} href={`/hotel/gift-cards/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                  <div>
                    <p className="font-mono text-sm font-semibold text-stone-800">{c.card_code}</p>
                    <p className="text-xs text-stone-500">{c.owner_label}{c.owner_contact ? ` · ${c.owner_contact}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-amber-700">{formatHours(c.balance_hours)} left</p>
                    <p className="text-xs text-stone-400">of {formatHours(c.total_hours)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Inactive cards ── */}
        {inactive.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-stone-600 uppercase tracking-wide">Inactive / expired</h2>
            <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white opacity-60">
              {inactive.map((c) => (
                <Link key={c.id} href={`/hotel/gift-cards/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                  <div>
                    <p className="font-mono text-sm font-semibold text-stone-500">{c.card_code}</p>
                    <p className="text-xs text-stone-400">{c.owner_label}</p>
                  </div>
                  <span className="text-xs text-stone-400">deactivated</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
