import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listBuyers, listComputationParams } from "@/lib/buyers/queries";
import { listUnitOptions } from "@/lib/collections/queries";
import { peso } from "@/lib/collections/summary";
import { BUYER_STATUSES, PAYMENT_SCHEMES } from "@/lib/config";
import { PageHeader, Badge } from "@/components/ui";
import { TableSearch } from "@/components/table-search";
import { AdjustableColumns } from "@/components/adjustable-columns";
import { BulkTable } from "@/components/data/bulk-table";
import { CsvImporter } from "@/components/data/csv-importer";
import { bulkImportBuyers, bulkSetBuyersActive, bulkDeleteBuyers } from "@/app/(app)/buyers/actions";
import { BUYERS_TEMPLATE } from "@/lib/imports/buyers";
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
  const canHardDelete = ["admin", "managing_officer", "consultant"].some((r) => user.roleKeys.includes(r));

  const [buyers, unitOptions, params] = await Promise.all([
    listBuyers(),
    canWrite ? listUnitOptions() : Promise.resolve([]),
    canManageParams ? listComputationParams() : Promise.resolve([]),
  ]).catch((e: unknown) => {
    // Log the real error to Vercel Function Logs so it can be traced by digest.
    console.error("[buyers/page] data fetch failed:", e);
    throw e;
  });

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

      {canWrite && (
        <div className="mb-4">
          <CsvImporter
            title="Import buyers from CSV"
            templateName="buyers_template.csv"
            templateCsv={BUYERS_TEMPLATE}
            requiredHeaders={["unit_number", "ref_pin"]}
            commit={bulkImportBuyers}
          />
        </div>
      )}

      <TableSearch placeholder="Search buyers by unit, name, status…">
      <AdjustableColumns storageKey="buyers">
      <BulkTable
        canWrite={canWrite}
        canHardDelete={canHardDelete}
        deactivate={(ids) => bulkSetBuyersActive(ids, false)}
        hardDelete={bulkDeleteBuyers}
        entityLabel="buyer(s)"
        emptyText={`No buyers yet.${canWrite ? " Add one to begin." : ""}`}
        columns={[{ header: "Unit" }, { header: "Buyer" }, { header: "Scheme" }, { header: "Status" }, { header: "Balance", align: "right" }, { header: "Next due" }]}
        rows={buyers.map((b) => ({
          id: b.id,
          cells: [
            b.unit?.unit_number ?? "—",
            <Link key="n" href={`/buyers/${b.id}`} className="font-medium text-amber-700 hover:underline">{b.contact_label}</Link>,
            SCHEME_LABEL[b.payment_scheme] ?? b.payment_scheme,
            <span key="s" className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[b.payment_status] ?? "bg-stone-100 text-stone-700"}`}>{STATUS_LABEL[b.payment_status] ?? b.payment_status}</span>,
            b.contract_balance != null ? peso(b.contract_balance) : "—",
            b.next_due_date ?? "—",
          ],
        }))}
      />
      </AdjustableColumns>
      </TableSearch>
    </>
  );
}
