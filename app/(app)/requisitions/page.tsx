import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { TableSearch } from "@/components/table-search";
import { AdjustableColumns } from "@/components/adjustable-columns";
import { NewRequisition } from "@/components/requisitions/new-requisition";
import {
  listRequisitions, listMaterials, getOwnerThreshold, STATUS_LABEL, STATUS_TONE,
} from "@/lib/requisitions/queries";
import { peso } from "@/lib/collections/summary";

export const metadata = { title: "Requisitions & Purchasing" };

export default async function RequisitionsPage() {
  const user = await requireModule("requisitions");
  const canWrite = canWriteModule(user.roleKeys, "requisitions");
  const [reqs, catalog, threshold] = await Promise.all([
    listRequisitions(), listMaterials(), getOwnerThreshold(),
  ]);
  const open = reqs.filter((r) => !["received", "rejected", "cancelled"].includes(r.status)).length;

  return (
    <>
      <Breadcrumb items={[{ label: "Requisitions & Purchasing" }]} />
      <PageHeader
        title="Requisitions & Purchasing"
        subtitle={`Request materials, tools & supplies — endorsed by Operations, budget-checked by Accounting, and (over ₱${threshold.toLocaleString("en-PH")}) approved by the Owner before purchasing.`}
        badge={<Badge tone="amber">{open} open</Badge>}
      />

      {canWrite && (
        <div className="mb-4">
          <NewRequisition catalog={catalog} />
        </div>
      )}

      <TableSearch placeholder="Search by ref #, title, line, status…">
      <AdjustableColumns storageKey="requisitions">
      <div className="table-wrap">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Ref #</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Line / Area</th>
              <th className="px-4 py-3 text-right">Est. total</th>
              <th className="px-4 py-3">Needed by</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {reqs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">No requisitions yet.</td></tr>
            )}
            {reqs.map((r) => (
              <tr key={r.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5 font-mono text-xs text-stone-500">
                  <Link href={`/requisitions/${r.id}`} className="text-amber-700 hover:underline">{r.refNo ?? r.id.slice(0, 8)}</Link>
                </td>
                <td className="px-4 py-2.5 font-medium text-stone-800">{r.title}</td>
                <td className="px-4 py-2.5 text-stone-500">{r.businessLine ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.estTotal)}</td>
                <td className="px-4 py-2.5 text-stone-500">{r.neededBy ?? "—"}</td>
                <td className="px-4 py-2.5"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </AdjustableColumns>
      </TableSearch>
    </>
  );
}
