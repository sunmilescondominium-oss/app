import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { TableSearch } from "@/components/table-search";
import { AdjustableColumns } from "@/components/adjustable-columns";
import { BulkTable } from "@/components/data/bulk-table";
import { NewRequisition } from "@/components/requisitions/new-requisition";
import { bulkCancelRequisitions, bulkDeleteRequisitions } from "@/app/(app)/requisitions/actions";
import {
  listRequisitions, listMaterials, getOwnerThreshold, STATUS_LABEL, STATUS_TONE,
} from "@/lib/requisitions/queries";
import { peso } from "@/lib/collections/summary";

export const metadata = { title: "Requisitions & Purchasing" };

export default async function RequisitionsPage() {
  const user = await requireModule("requisitions");
  const canWrite = canWriteModule(user.roleKeys, "requisitions");
  const canHardDelete = ["admin", "managing_officer", "consultant"].some((r) => user.roleKeys.includes(r));
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
      <BulkTable
        canWrite={canWrite}
        canHardDelete={canHardDelete}
        deactivate={bulkCancelRequisitions}
        deactivateLabel="Cancel"
        hardDelete={bulkDeleteRequisitions}
        entityLabel="requisition(s)"
        emptyText="No requisitions yet."
        minWidth="820px"
        columns={[{ header: "Ref #" }, { header: "Title" }, { header: "Line / Area" }, { header: "Est. total", align: "right" }, { header: "Needed by" }, { header: "Status" }]}
        rows={reqs.map((r) => ({
          id: r.id,
          cells: [
            <Link key="ref" href={`/requisitions/${r.id}`} className="font-mono text-xs text-amber-700 hover:underline">{r.refNo ?? r.id.slice(0, 8)}</Link>,
            <span key="t" className="font-medium text-stone-800">{r.title}</span>,
            r.businessLine ?? "—",
            peso(r.estTotal),
            r.neededBy ?? "—",
            <Badge key="s" tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
          ],
        }))}
      />
      </AdjustableColumns>
      </TableSearch>
    </>
  );
}
