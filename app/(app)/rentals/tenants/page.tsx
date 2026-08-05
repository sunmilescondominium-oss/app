import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listTenants } from "@/lib/rentals/queries";
import { peso } from "@/lib/collections/summary";
import { canWriteModule } from "@/lib/rbac/modules";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { TableSearch } from "@/components/table-search";
import { AdjustableColumns } from "@/components/adjustable-columns";
import { BulkTable } from "@/components/data/bulk-table";
import { CsvImporter } from "@/components/data/csv-importer";
import { bulkImportLeases, bulkEndLeases, bulkDeleteLeases } from "@/app/(app)/rentals/actions";
import { TENANTS_TEMPLATE } from "@/lib/imports/tenants";

export const metadata = { title: "Tenants" };

const LINE_TONE: Record<string, "blue" | "indigo"> = { rental: "blue", airbnb: "indigo" };

export default async function TenantsPage() {
  const user = await requireModule("rentals");
  const canWrite = canWriteModule(user.roleKeys, "rentals");
  const canHardDelete = ["admin", "managing_officer", "consultant"].some((r) => user.roleKeys.includes(r));
  const tenants = await listTenants();

  return (
    <>
      <Breadcrumb items={[{ label: "Rentals & Airbnb", href: "/rentals" }, { label: "Tenants" }]} />
      <PageHeader
        title="Tenants"
        subtitle="Everyone currently occupying a rental or Airbnb unit."
        badge={<Badge tone="green">{tenants.length} active</Badge>}
      />

      {canWrite && (
        <div className="mb-4">
          <CsvImporter
            title="Import tenants (leases) from CSV"
            templateName="tenants_template.csv"
            templateCsv={TENANTS_TEMPLATE}
            requiredHeaders={["unit_number", "tenant_label"]}
            commit={bulkImportLeases}
          />
        </div>
      )}

      <TableSearch placeholder="Search tenants by name, unit, contact…">
      <AdjustableColumns storageKey="tenants">
      <BulkTable
        canWrite={canWrite}
        canHardDelete={canHardDelete}
        deactivate={bulkEndLeases}
        deactivateLabel="End lease"
        hardDelete={bulkDeleteLeases}
        entityLabel="lease(s)"
        emptyText="No active tenants. Start a lease from a unit in Rentals & Airbnb."
        columns={[{ header: "Tenant" }, { header: "Unit" }, { header: "Type" }, { header: "Contact" }, { header: "Rent", align: "right" }, { header: "Since" }, { header: "Portal" }]}
        rows={tenants.map((t) => ({
          id: t.leaseId,
          cells: [
            <span key="t" className="font-medium text-stone-800">{t.tenantLabel}</span>,
            <span key="u"><Link href={`/rentals/${t.unitId}`} className="text-amber-700 hover:underline">{t.unitNumber}</Link>{t.propertyName && <span className="block text-xs text-stone-400">{t.propertyName}</span>}</span>,
            <Badge key="ty" tone={LINE_TONE[t.businessLine] ?? "slate"}>{t.businessLine}</Badge>,
            t.contact ?? "—",
            <span key="r">{peso(t.rentAmount)}<span className="text-xs text-stone-400">/{t.billingCycle === "nightly" ? "night" : "mo"}</span></span>,
            t.startDate,
            t.hasPin ? <span key="p" className="text-emerald-700">PIN set ✓</span> : <span key="p" className="text-stone-400">no PIN</span>,
          ],
        }))}
      />
      </AdjustableColumns>
      </TableSearch>
      <p className="mt-3 text-xs text-stone-400">Whoever is entered on a rental/Airbnb unit is a tenant. They view their bills through the renter portal using their unit # + PIN (set the PIN on the unit&rsquo;s detail page).</p>
    </>
  );
}
