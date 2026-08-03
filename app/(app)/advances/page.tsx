import Link from "next/link";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { ADVANCE_APPROVER_ROLES, ADVANCE_RELEASE_ROLES } from "@/lib/rbac/modules";
import { listAdvances } from "@/lib/advances/queries";
import { peso } from "@/lib/collections/summary";
import { ADVANCE_STATUSES } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { RequestAdvanceForm, AdvanceRowActions } from "@/components/advances/advance-forms";

export const metadata = { title: "Cash Advance" };

const TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-700",
  released: "bg-emerald-100 text-emerald-700",
  liquidated: "bg-stone-200 text-stone-600",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-stone-100 text-stone-500",
};
const label = (k: string) => ADVANCE_STATUSES.find((s) => s.key === k)?.label ?? k;

export default async function AdvancesPage() {
  const user = await requireModule("advances");
  const canApprove = userHasAnyRole(user, ADVANCE_APPROVER_ROLES);
  const canRelease = userHasAnyRole(user, ADVANCE_RELEASE_ROLES);
  const rows = await listAdvances(user.userId, canApprove);

  return (
    <>
      <PageHeader
        backHref="/dashboard" title="Cash Advance" subtitle="Request, approve, release & liquidate cash advances." />

      <div className="mt-4 mb-6"><RequestAdvanceForm /></div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {canApprove && <th className="px-4 py-3">Requested by</th>}
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Needed by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Liquidated</th>
              <th className="px-4 py-3 text-right">·</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={canApprove ? 7 : 6} className="px-4 py-8 text-center text-stone-500">No cash advances yet.</td></tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-stone-100 last:border-0">
                {canApprove && <td className="px-4 py-2.5">{a.label}</td>}
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(a.amount)}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/advances/${a.id}`} className="text-amber-700 hover:underline">{a.purpose}</Link>
                  {a.decision_note && <span className="block text-[11px] text-stone-400">note: {a.decision_note}</span>}
                </td>
                <td className="px-4 py-2.5 text-stone-500">{a.needed_by ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[a.status] ?? "bg-stone-100 text-stone-500"}`}>{label(a.status)}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{a.liquidated_total != null ? peso(a.liquidated_total) : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <AdvanceRowActions id={a.id} status={a.status} isOwner={a.user_id === user.userId} canApprove={canApprove} canRelease={canRelease} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-400">Open a request to record liquidation once funds are released.</p>
    </>
  );
}
