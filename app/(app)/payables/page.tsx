import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { TableSearch } from "@/components/table-search";
import { listPayees, listPayables, payablesSummary, PAYABLE_APPROVER_ROLES, PAYABLE_RELEASE_ROLES } from "@/lib/payables/queries";
import { PayeeManager } from "@/components/payables/payee-manager";
import { NewPayable } from "@/components/payables/new-payable";
import { PayablesTable } from "@/components/payables/payables-table";
import { peso } from "@/lib/collections/summary";

export const metadata = { title: "Commissions & Payables" };

export default async function PayablesPage() {
  const user = await requireModule("payables");
  const canWrite = canWriteModule(user.roleKeys, "payables");
  const canApprove = userHasAnyRole(user, PAYABLE_APPROVER_ROLES);
  const canRelease = userHasAnyRole(user, PAYABLE_RELEASE_ROLES);
  const [payees, payables, sum] = await Promise.all([listPayees(), listPayables(), payablesSummary()]);

  const cards = [
    { label: "Pending", value: sum.pending, tone: "text-amber-700" },
    { label: "Approved (to release)", value: sum.approved, tone: "text-blue-700" },
    { label: "Released", value: sum.released, tone: "text-emerald-700" },
  ];

  return (
    <>
      <Breadcrumb items={[{ label: "Commissions & Payables" }]} />
      <PageHeader
        title="Commissions & Payables"
        subtitle="Allowances, referral fees, broker commissions (with sub-agents & override), marketing funds, incentives & rewards — pending → approved → released."
        badge={<Badge tone="amber">{peso(sum.pending + sum.approved)} outstanding</Badge>}
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className={`text-xl font-bold tabular-nums ${c.tone}`}>{peso(c.value)}</p>
            <p className="text-xs text-stone-500">{c.label}</p>
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="mb-4 space-y-3">
          <PayeeManager payees={payees} />
          <NewPayable payees={payees} />
        </div>
      )}

      <TableSearch placeholder="Search payables by payee, type, status…">
        <PayablesTable payables={payables} canApprove={canApprove} canRelease={canRelease} />
      </TableSearch>
    </>
  );
}
