import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listBuyers, listComputationParams } from "@/lib/buyers/queries";
import { listUnitOptions } from "@/lib/collections/queries";
import { peso } from "@/lib/collections/summary";
import { BUYER_STATUSES, PAYMENT_SCHEMES } from "@/lib/config";
import { PageHeader, Badge } from "@/components/ui";
import { TableSearch } from "@/components/table-search";
import { BuyersToolbar } from "@/components/buyers/buyers-toolbar";

export const metadata = { title: "Buyers" };

const STATUS_CLS: Record<string, string> = {
  current: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-700",
  restructured: "bg-amber-100 text-amber-800",
  in_dispute: "bg-stone-200 text-stone-700",
};
const STATUS_LABEL = Object.fromEntries(BUYER_STATUSES.map((s) => [s.key, s.label]));
const SCHEME_LABEL = Object.fromEntries(PAYMENT_SCHEMES.map((s) => [s.key, s.label]));

export default async function BuyersPage() {
  const user = await requireModule("buyers");
  const canWrite = canWriteModule(user.roleKeys, "buyers");
  const canManageParams = user.roleKeys.some((r) => ["admin", "consultant"].includes(r));

  const [buyers, unitOptions, params] = await Promise.all([
    listBuyers(),
    canWrite ? listUnitOptions() : Promise.resolve([]),
    canManageParams ? listComputationParams() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Buyers"
        subtitle="Buyer accounts, Statement of Account & payment history"
        badge={<Badge tone="green">Live</Badge>}
      />

      <BuyersToolbar
        unitOptions={unitOptions}
        params={params}
        canWrite={canWrite}
        canManageParams={canManageParams}
      />

      <TableSearch placeholder="Search buyers by unit, name, status…">
      <div className="table-wrap">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Scheme</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Next due</th>
            </tr>
          </thead>
          <tbody>
            {buyers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                  No buyers yet. {canWrite && "Add one to begin."}
                </td>
              </tr>
            )}
            {buyers.map((b) => (
              <tr key={b.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-3">{b.unit?.unit_number ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-stone-900">
                  <Link href={`/buyers/${b.id}`} className="text-amber-700 hover:underline">
                    {b.contact_label}
                  </Link>
                </td>
                <td className="px-4 py-3">{SCHEME_LABEL[b.payment_scheme] ?? b.payment_scheme}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLS[b.payment_status] ?? "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {STATUS_LABEL[b.payment_status] ?? b.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {b.contract_balance != null ? peso(b.contract_balance) : "—"}
                </td>
                <td className="px-4 py-3">{b.next_due_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </TableSearch>
    </>
  );
}
