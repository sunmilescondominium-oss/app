import Link from "next/link";
import { requireAuth } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { getDashboard } from "@/lib/dashboard/queries";
import { peso } from "@/lib/collections/summary";
import { guidesForRoles } from "@/lib/guides/role-guides";
import { myPhotoPath } from "@/lib/employee/queries";
import { Avatar } from "@/components/employees/avatar";
import { LaunchPad } from "@/components/guide/launch-pad";

export const metadata = { title: "Dashboard" };

type Tone = "slate" | "green" | "amber" | "rose" | "indigo";

const TONE_TEXT: Record<Tone, string> = {
  slate: "text-stone-900",
  green: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
  indigo: "text-indigo-700",
};
const TONE_BAR: Record<Tone, string> = {
  slate: "bg-stone-300",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  indigo: "bg-indigo-400",
};

function StatLink({ href, icon, label, value, sub, tone = "slate" }: { href: string; icon: string; label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <Link href={href} className="card card-hover group relative overflow-hidden p-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${TONE_BAR[tone]}`} />
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <span aria-hidden className="text-lg opacity-70">{icon}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-400">{sub}</p>}
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 opacity-0 transition group-hover:opacity-100">
        Open <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const has = (r: string) => user.roleKeys.includes(r);
  const can = (m: Parameters<typeof canReadModule>[1]) => canReadModule(user.roleKeys, m);
  const [d, photoPath] = await Promise.all([getDashboard(), myPhotoPath(user.userId)]);

  const cards: React.ReactNode[] = [];

  if (has("owner")) cards.push(<StatLink key="owner" href="/owner" icon="📊" label="Owner overview" value="Open" sub="Weekly summary & decisions" tone="indigo" />);

  if (can("collections") || has("hotel_cashier"))
    cards.push(<StatLink key="col" href="/collections" icon="💵" label="Collected today" value={peso(d.collectionsToday)} sub="All business lines" tone="green" />);

  if (can("transmittals"))
    cards.push(<StatLink key="tx" href="/transmittals" icon="🧾" label="Transmittals to process" value={String(d.txPending)} sub="submitted / deposited" tone={d.txPending > 0 ? "amber" : "slate"} />);

  if (can("banking"))
    cards.push(<StatLink key="bank" href="/banking" icon="🏦" label="Bank & reconciliation" value="Open" sub="Accounts, deposits & checks" tone="indigo" />);

  if (can("hotel"))
    cards.push(<StatLink key="hotel" href="/hotel" icon="🏨" label="Hotel rooms" value={`${d.hotel.occupied} in`} sub={`${d.hotel.vacant} vacant · ${d.hotel.forHousekeeping} for housekeeping`} />);

  if (can("rentals"))
    cards.push(<StatLink key="rent" href="/rentals" icon="🏘️" label="Rentals & Airbnb" value={`${d.rentals.occupied} occupied`} sub={`${d.rentals.vacant} vacant · ${d.rentals.duesFlagged} dues due/overdue`} tone={d.rentals.duesFlagged > 0 ? "amber" : "slate"} />);

  if (can("condo"))
    cards.push(<StatLink key="condo" href="/condo" icon="🏢" label="Condo dues" value="Open" sub="Association dues per unit" />);

  if (can("housekeeping"))
    cards.push(<StatLink key="hk" href="/housekeeping" icon="🧹" label="Housekeeping tasks" value={String(d.housekeepingOpen)} sub="pending / in progress" tone={d.housekeepingOpen > 0 ? "amber" : "slate"} />);

  if (can("hr") || can("scheduling"))
    cards.push(<StatLink key="att" href={can("hr") ? "/hr" : "/schedule"} icon="🕒" label="Attendance today" value={`${d.attendance.checkedIn} in`} sub={`${d.attendance.checkedOut} clocked out`} />);

  if (can("employees") || has("owner"))
    cards.push(<StatLink key="req" href={can("employees") ? "/employees" : "/owner"} icon="📝" label="Pending requests" value={String(d.pendingRequests)} sub="leave / OB to approve" tone={d.pendingRequests > 0 ? "amber" : "slate"} />);

  if (can("repair"))
    cards.push(<StatLink key="rep" href="/repairs" icon="🔧" label="Open repairs" value={String(d.repairsOpen)} sub="not yet completed" tone={d.repairsOpen > 0 ? "amber" : "slate"} />);

  if (can("employees"))
    cards.push(<StatLink key="emp" href="/employees" icon="👥" label="Employees / 201 files" value="Open" sub="Roster, 201 records & documents" />);

  if (can("finance"))
    cards.push(<StatLink key="fin" href="/finance" icon="📈" label="P&L / Reports" value="Open" sub="Sales, expenses & profit" tone="green" />);

  return (
    <>
      <div className="mb-6 flex items-center gap-4 border-b border-stone-200/80 pb-4">
        <Avatar id={user.userId} label={user.displayLabel} photoPath={photoPath} size={56} />
        <div className="min-w-0">
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-amber-700">Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-[1.75rem]">Welcome, {user.displayLabel}</h1>
          <p className="mt-1 text-sm text-stone-500">The numbers relevant to your role, at a glance.</p>
        </div>
      </div>

      <LaunchPad guides={guidesForRoles(user.roleKeys)} />
      {cards.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">No dashboard widgets for your role yet — use the menu to open a module.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      )}
    </>
  );
}
