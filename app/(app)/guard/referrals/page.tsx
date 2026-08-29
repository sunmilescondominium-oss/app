import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { listReferralDrivers, listReferralHistory } from "@/lib/guard/referral-queries";
import { PageHeader, Badge } from "@/components/ui";
import { AddDriverButton, DriverRow } from "./driver-editor";
import { VerifyReferralButton } from "./verify-button";

export const metadata = { title: "Referral Drivers" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
  });
}

function peso(n: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
}

export default async function ReferralDriversPage() {
  const user = await requireModule("guard");
  const canManage = userHasAnyRole(user, ["admin", "managing_officer", "hotel_rental_monitoring", "consultant"]);

  const [drivers, history] = await Promise.all([
    listReferralDrivers(),
    listReferralHistory(60),
  ]);

  const activeCount = drivers.filter((d) => d.status === "active").length;
  const pendingVerification = history.filter((r) => !r.verified);
  const totalReferralFees = history.reduce((s, r) => s + r.referralAmount, 0);

  return (
    <>
      <PageHeader
        backHref="/guard"
        title="Referral Drivers"
        subtitle="Accredited tricycle & vehicle registry · referral fee log"
        badge={<Badge tone="green">{activeCount} active</Badge>}
      />

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs text-stone-500">Active drivers</p>
          <p className="text-2xl font-bold text-stone-800">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs text-stone-500">Referrals (last 60)</p>
          <p className="text-2xl font-bold text-stone-800">{history.length}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-700">Total referral fees</p>
          <p className="text-2xl font-bold text-amber-900">{peso(totalReferralFees)}</p>
        </div>
      </div>

      {/* Driver roster */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Accredited drivers</h2>
          {canManage && <AddDriverButton />}
        </div>

        {drivers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
            No drivers registered yet.{" "}
            {canManage && 'Click "Add driver" to register the first one.'}
          </div>
        ) : (
          <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden">
            {drivers.map((d) => (
              <DriverRow key={d.id} driver={d} canManage={canManage} />
            ))}
          </div>
        )}
      </section>

      {/* Referral history */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Referral log</h2>
          {pendingVerification.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {pendingVerification.length} pending verification
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-400">
            No referrals recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Room</th>
                  <th className="px-4 py-2.5 font-medium">Guest</th>
                  <th className="px-4 py-2.5 font-medium">Plate</th>
                  <th className="px-4 py-2.5 font-medium">Driver</th>
                  <th className="px-4 py-2.5 font-medium text-right">Fee</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {history.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5 text-xs text-stone-500 whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-stone-800">
                      {r.unitNumber}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600 max-w-[160px] truncate">
                      {r.guestLabel}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-stone-700">
                      {r.plateNumber}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-stone-500">
                      {r.driverName ?? <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-stone-800">
                      {peso(r.referralAmount)}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.verified ? (
                        <span className="text-xs font-medium text-green-700">✓ Verified</span>
                      ) : canManage ? (
                        <VerifyReferralButton referralId={r.id} />
                      ) : (
                        <span className="text-xs text-amber-600">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
