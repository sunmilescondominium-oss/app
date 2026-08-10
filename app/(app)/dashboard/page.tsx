import Link from "next/link";
import { requireAuth } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { getDashboard } from "@/lib/dashboard/queries";
import { peso } from "@/lib/collections/summary";
import { guidesForRoles } from "@/lib/guides/role-guides";
import { myPhotoPath } from "@/lib/employee/queries";
import { Avatar } from "@/components/employees/avatar";
import { LaunchPad } from "@/components/guide/launch-pad";
import { getLang } from "@/lib/i18n-server";
import { t, type Lang } from "@/lib/i18n";
import { listPendingRequests } from "@/lib/authorizations/queries";
import { PendingApprovals } from "@/components/authorizations/pending-approvals";

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

function StatLink({ href, icon, label, value, sub, tone = "slate", lang = "en" }: { href: string; icon: string; label: string; value: string; sub?: string; tone?: Tone; lang?: Lang }) {
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
        {t(lang, "db_open")} <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const lang = await getLang();
  const tr = (k: string) => t(lang, k);
  const has = (r: string) => user.roleKeys.includes(r);
  const can = (m: Parameters<typeof canReadModule>[1]) => canReadModule(user.roleKeys, m);
  const isApprover = user.roleKeys.some((r) => ["admin", "managing_officer", "consultant"].includes(r));
  const [d, photoPath, pendingRequests] = await Promise.all([
    getDashboard(),
    myPhotoPath(user.userId),
    isApprover ? listPendingRequests() : Promise.resolve([]),
  ]);

  const cards: React.ReactNode[] = [];

  if (has("owner")) cards.push(<StatLink key="owner" lang={lang} href="/owner" icon="📊" label={tr("dc_owner")} value={tr("db_open")} sub={tr("dc_owner_sub")} tone="indigo" />);

  if (can("collections") || has("hotel_cashier"))
    cards.push(<StatLink key="col" lang={lang} href="/collections" icon="💵" label={tr("dc_col")} value={peso(d.collectionsToday)} sub={tr("dc_col_sub")} tone="green" />);

  if (can("transmittals"))
    cards.push(<StatLink key="tx" lang={lang} href="/transmittals" icon="🧾" label={tr("dc_tx")} value={String(d.txPending)} sub={tr("dc_tx_sub")} tone={d.txPending > 0 ? "amber" : "slate"} />);

  if (can("banking"))
    cards.push(<StatLink key="bank" lang={lang} href="/banking" icon="🏦" label={tr("dc_bank")} value={tr("db_open")} sub={tr("dc_bank_sub")} tone="indigo" />);

  if (can("hotel"))
    cards.push(<StatLink key="hotel" lang={lang} href="/hotel" icon="🏨" label={tr("dc_hotel")} value={`${d.hotel.occupied} ${tr("dw_in")}`} sub={`${d.hotel.vacant} ${tr("dw_vacant")} · ${d.hotel.forHousekeeping} ${tr("dw_for_hk")}`} />);

  if (can("rentals"))
    cards.push(<StatLink key="rent" lang={lang} href="/rentals" icon="🏘️" label={tr("dc_rent")} value={`${d.rentals.occupied} ${tr("dw_occupied")}`} sub={`${d.rentals.vacant} ${tr("dw_vacant")} · ${d.rentals.duesFlagged} ${tr("dw_dues_flagged")}`} tone={d.rentals.duesFlagged > 0 ? "amber" : "slate"} />);

  if (can("condo"))
    cards.push(<StatLink key="condo" lang={lang} href="/condo" icon="🏢" label={tr("dc_condo")} value={tr("db_open")} sub={tr("dc_condo_sub")} />);

  if (can("housekeeping"))
    cards.push(<StatLink key="hk" lang={lang} href="/housekeeping" icon="🧹" label={tr("dc_hk")} value={String(d.housekeepingOpen)} sub={tr("dc_hk_sub")} tone={d.housekeepingOpen > 0 ? "amber" : "slate"} />);

  if (can("hr") || can("scheduling"))
    cards.push(<StatLink key="att" lang={lang} href={can("hr") ? "/hr" : "/schedule"} icon="🕒" label={tr("dc_att")} value={`${d.attendance.checkedIn} ${tr("dw_in")}`} sub={`${d.attendance.checkedOut} ${tr("dw_clocked_out")}`} />);

  if (can("employees") || has("owner"))
    cards.push(<StatLink key="req" lang={lang} href={can("employees") ? "/employees" : "/owner"} icon="📝" label={tr("dc_req")} value={String(d.pendingRequests)} sub={tr("dc_req_sub")} tone={d.pendingRequests > 0 ? "amber" : "slate"} />);

  if (can("repair"))
    cards.push(<StatLink key="rep" lang={lang} href="/repairs" icon="🔧" label={tr("dc_rep")} value={String(d.repairsOpen)} sub={tr("dc_rep_sub")} tone={d.repairsOpen > 0 ? "amber" : "slate"} />);

  if (can("employees"))
    cards.push(<StatLink key="emp" lang={lang} href="/employees" icon="👥" label={tr("dc_emp")} value={tr("db_open")} sub={tr("dc_emp_sub")} />);

  if (can("finance"))
    cards.push(<StatLink key="fin" lang={lang} href="/finance" icon="📈" label={tr("dc_fin")} value={tr("db_open")} sub={tr("dc_fin_sub")} tone="green" />);

  return (
    <>
      <div className="mb-6 flex items-center gap-4 border-b border-stone-200/80 pb-4">
        <Avatar id={user.userId} label={user.displayLabel} photoPath={photoPath} size={56} />
        <div className="min-w-0">
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-amber-700">{tr("db_eyebrow")}</p>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-[1.75rem]">{tr("db_welcome")}, {user.displayLabel}</h1>
          <p className="mt-1 text-sm text-stone-500">{tr("db_subtitle")}</p>
        </div>
      </div>

      <LaunchPad guides={guidesForRoles(user.roleKeys)} lang={lang} />
      {pendingRequests.length > 0 && (
        <div className="mb-4">
          <PendingApprovals requests={pendingRequests} />
        </div>
      )}
      {cards.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">{tr("db_no_widgets")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      )}
    </>
  );
}
