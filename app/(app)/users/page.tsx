import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listUsersWithRoles, listRoles } from "@/lib/users/queries";
import { listFeatureFlags } from "@/lib/settings/flags";
import { PageHeader, Badge } from "@/components/ui";
import { UsersTable } from "@/components/users/users-table";
import { TableSearch } from "@/components/table-search";
import { AdjustableColumns } from "@/components/adjustable-columns";
import { FeatureFlags } from "@/components/users/feature-flags";
import { CsvImporter } from "@/components/data/csv-importer";
import { STAFF_TEMPLATE } from "@/lib/imports/staff";
import { bulkImportStaff } from "@/app/(app)/users/actions";

export const metadata = { title: "Users & Roles" };

export default async function UsersPage() {
  const user = await requireModule("users");
  const canWrite = canWriteModule(user.roleKeys, "users");

  const [allUsers, roles, flags] = await Promise.all([listUsersWithRoles(), listRoles(), listFeatureFlags()]);
  // The consultant is hidden from everyone except the consultant + accounting.
  const canSeeConsultant = user.allRoleKeys.some((r) => ["consultant", "accounting"].includes(r));
  const users = canSeeConsultant ? allUsers : allUsers.filter((u) => !u.roleKeys.includes("consultant"));

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Users & Roles"
        subtitle="Give each person the roles their task needs — access to every module follows from the role."
        badge={<Badge tone="green">Live</Badge>}
      />
      {canWrite && (
        <div className="mb-4">
          <a href="/users/access" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
            ⚙ Access Control — grant modules per role
          </a>
        </div>
      )}

      {canWrite && (
        <div className="mb-4">
          <CsvImporter
            title="Bulk-add staff from CSV"
            templateName="staff_template.csv"
            templateCsv={STAFF_TEMPLATE}
            requiredHeaders={["email", "display_label", "roles"]}
            commit={bulkImportStaff}
          />
        </div>
      )}

      {canWrite && flags.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Optional modules</h2>
          <FeatureFlags flags={flags} />
        </div>
      )}
      <TableSearch placeholder="Search users by email or role…">
        <AdjustableColumns storageKey="users">
          <UsersTable
            users={users}
            roles={roles}
            canWrite={canWrite}
            currentUserId={user.userId}
            canImpersonate={user.allRoleKeys.includes("consultant")}
            canHardDelete={["consultant", "admin"].some((r) => user.allRoleKeys.includes(r))}
          />
        </AdjustableColumns>
      </TableSearch>
    </>
  );
}
