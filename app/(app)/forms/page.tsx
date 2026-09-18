import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { TableSearch } from "@/components/table-search";
import { listBooklets, listFormTypes, custodianOptions, listBusinessEntities, FORM_MANAGER_ROLES } from "@/lib/forms/queries";
import { listRoles } from "@/lib/users/queries";
import { RegisterBooklet } from "@/components/forms/register-booklet";
import { BusinessEntities } from "@/components/forms/business-entities";
import { ManageFormTypes } from "@/components/forms/manage-form-types";
import { BookletTable } from "@/components/forms/booklet-table";

export const metadata = { title: "Accountable Forms" };

export default async function FormsPage() {
  const user = await requireModule("accountable_forms");
  const canManage = userHasAnyRole(user, FORM_MANAGER_ROLES);
  const [booklets, types, custodians, entities, allRoles] = await Promise.all([listBooklets(), listFormTypes(), canManage ? custodianOptions() : Promise.resolve([]), listBusinessEntities(), canManage ? listRoles() : Promise.resolve([])]);
  const staffRoles = allRoles.filter((r) => r.is_staff).map((r) => ({ key: r.role_key, label: r.label }));
  const openBooklets = booklets.filter((b) => b.status === "active").length;

  return (
    <>
      <Breadcrumb items={[{ label: "Accountable Forms" }]} />
      <PageHeader
        title="Accountable Forms"
        subtitle="Serialized OR / AR / checks & other controlled forms — custodian, per-serial status and reconciliation."
        badge={<Badge tone="amber">{openBooklets} active</Badge>}
      />

      {canManage && (
        <div className="mb-4 space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <BusinessEntities entities={entities} />
            <ManageFormTypes types={types} />
          </div>
          <RegisterBooklet types={types} custodians={custodians} entities={entities} roles={staffRoles} />
        </div>
      )}

      <TableSearch placeholder="Search booklets by no., type, custodian…">
        <div className="table-wrap">
          <BookletTable
            booklets={booklets}
            canManage={canManage}
            types={types}
            custodians={custodians}
            entities={entities}
            roles={staffRoles}
          />
        </div>
      </TableSearch>
    </>
  );
}
