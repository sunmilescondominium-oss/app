import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { getRoomPerformance } from "@/lib/hotel/queries";
import { PageHeader, Breadcrumb } from "@/components/ui";

export const metadata = { title: "Room Performance" };

const SUPERVISOR_ROLES = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"];

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (n: number) => `${n.toFixed(1)}%`;

function defaultDateRange() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` };
}

export default async function RoomPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireModule("hotel");
  if (!user.roleKeys.some((r) => SUPERVISOR_ROLES.includes(r))) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        You do not have permission to view room performance reports.
      </div>
    );
  }

  const { from: fromParam, to: toParam } = await searchParams;
  const defaults = defaultDateRange();
  const from = fromParam ?? defaults.from;
  const to   = toParam   ?? defaults.to;

  const data = await getRoomPerformance(from, to);

  const occBar = (pct: number) => {
    const w = Math.min(100, Math.max(0, pct));
    const color = w >= 70 ? "bg-emerald-500" : w >= 40 ? "bg-amber-400" : "bg-rose-400";
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-stone-200">
          <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${w}%` }} />
        </div>
        <span className="tabular-nums text-xs text-stone-600">{pct.toFixed(1)}%</span>
      </div>
    );
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Hotel Ops", href: "/hotel" },
          { label: "Room Performance" },
        ]}
      />
      <PageHeader
        title="Room Performance"
        subtitle="ADR, RevPAR, and occupancy metrics for the selected period."
      />

      {/* Date filter */}
      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Apply
        </button>
        <Link
          href="/hotel/performance"
          className="rounded-lg border border-stone-200 px-4 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Reset
        </Link>
      </form>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        {[
          { label: "Total Revenue", value: peso(data.totalRevenue), sub: `${data.totalStays} stays` },
          { label: "ADR", value: peso(data.adr), sub: "avg daily rate / stay" },
          { label: "RevPAR", value: peso(data.revpar), sub: "revenue per avail. room-day" },
          { label: "Occupancy", value: pct(data.occupancyPct), sub: `${data.totalRooms} rooms · ${Math.round(data.periodHours / 24)} days` },
          { label: "Total Stays", value: String(data.totalStays), sub: `${data.totalRooms} rooms total` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-500">{k.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-stone-900">{k.value}</p>
            <p className="text-[11px] text-stone-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* By room type */}
      {data.byType.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">By room type</h2>
          <div className="table-wrap">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Rooms</th>
                  <th className="px-4 py-2.5 text-right">Stays</th>
                  <th className="px-4 py-2.5 text-right">Revenue</th>
                  <th className="px-4 py-2.5">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {data.byType.map((t) => (
                  <tr key={t.type} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{t.type}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{t.rooms}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{t.stays}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700">{peso(t.revenue)}</td>
                    <td className="px-4 py-2.5">{occBar(t.occupancyPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-room breakdown */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Per-room breakdown</h2>
      <div className="table-wrap">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2.5">Room</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5 text-right">Stays</th>
              <th className="px-4 py-2.5 text-right">Revenue</th>
              <th className="px-4 py-2.5 text-right">Avg Rate</th>
              <th className="px-4 py-2.5 text-right">Avg hrs/stay</th>
              <th className="px-4 py-2.5">Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {data.rooms.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                  No stays found for this period.
                </td>
              </tr>
            )}
            {data.rooms.map((r) => (
              <tr key={r.unitId} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5 font-medium">{r.unitNumber}</td>
                <td className="px-4 py-2.5 text-stone-500">{r.unitType ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.totalStays}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700">
                  {r.totalRevenue > 0 ? peso(r.totalRevenue) : <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">
                  {r.avgRate > 0 ? peso(r.avgRate) : <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">
                  {r.avgStayHours > 0 ? `${r.avgStayHours}h` : <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-2.5">{occBar(r.occupancyPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.rooms.length > 0 && (
        <p className="mt-3 text-xs text-stone-400">
          Occupancy = occupied hours ÷ available room-hours in period · ADR = revenue ÷ # stays · RevPAR = total revenue ÷ (rooms × days)
        </p>
      )}
    </>
  );
}
