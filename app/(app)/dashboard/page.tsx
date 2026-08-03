import Link from "next/link";
import { requireAuth } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { getDashboard } from "@/lib/dashboard/queries";
import { peso } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Dashboard" };

function Card({ href, label, value, sub, tone = "text-slate-900" }: { href: string; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const has = (r: string) => user.roleKeys.includes(r);
  const can = (m: Parameters<typeof canReadModule>[1]) => canReadModule(user.roleKeys, m);
  const d = await getDashboard();

  const cards: React.ReactNode[] = [];

  if (has("owner")) cards.push(<Card key="owner" href="/owner" label="Owner overview" value="Open →" sub="Weekly summary & decisions" />);

  if (can("collections") || has("hotel_cashier"))
    cards.push(<Card key="col" href="/collections" label="Collected today" value={peso(d.collectionsToday)} sub="All business lines" tone="text-emerald-700" />);

  if (can("transmittals"))
    cards.push(<Card key="tx" href="/transmittals" label="Transmittals to process" value={String(d.txPending)} sub="submitted / deposited" tone={d.txPending > 0 ? "text-amber-700" : "text-slate-900"} />);

  if (can("hotel"))
    cards.push(<Card key="hotel" href="/hotel" label="Hotel rooms" value={`${d.hotel.occupied} in`} sub={`${d.hotel.vacant} vacant · ${d.hotel.forHousekeeping} for housekeeping`} />);

  if (can("rentals"))
    cards.push(<Card key="rent" href="/rentals" label="Rentals & Airbnb" value={`${d.rentals.occupied} occupied`} sub={`${d.rentals.vacant} vacant · ${d.rentals.duesFlagged} dues due/overdue`} tone={d.rentals.duesFlagged > 0 ? "text-amber-700" : "text-slate-900"} />);

  if (can("housekeeping"))
    cards.push(<Card key="hk" href="/housekeeping" label="Housekeeping tasks" value={String(d.housekeepingOpen)} sub="pending / in progress" tone={d.housekeepingOpen > 0 ? "text-amber-700" : "text-slate-900"} />);

  if (can("hr") || can("scheduling"))
    cards.push(<Card key="att" href={can("hr") ? "/hr" : "/schedule"} label="Attendance today" value={`${d.attendance.checkedIn} in`} sub={`${d.attendance.checkedOut} clocked out`} />);

  if (can("employees") || has("owner"))
    cards.push(<Card key="req" href={can("employees") ? "/employees" : "/owner"} label="Pending requests" value={String(d.pendingRequests)} sub="leave / OB to approve" tone={d.pendingRequests > 0 ? "text-amber-700" : "text-slate-900"} />);

  if (can("repair"))
    cards.push(<Card key="rep" href="/repairs" label="Open repairs" value={String(d.repairsOpen)} sub="not yet completed" tone={d.repairsOpen > 0 ? "text-amber-700" : "text-slate-900"} />);

  if (can("finance"))
    cards.push(<Card key="fin" href="/finance" label="P&L / Reports" value="Open →" sub="Sales, expenses & profit" />);

  return (
    <>
      <PageHeader title={`Welcome, ${user.displayLabel}`} subtitle="Your dashboard — the numbers relevant to your role." />
      {cards.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No dashboard widgets for your role yet — use the menu to open a module.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      )}
    </>
  );
}
