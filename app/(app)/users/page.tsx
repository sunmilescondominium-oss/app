import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listUsersWithRoles, listRoles } from "@/lib/users/queries";
import { PageHeader, Badge } from "@/components/ui";
import { UsersTable } from "@/components/users/users-table";

export const metadata = { title: "Users & Roles" };

export default async function UsersPage() {
  const user = await requireModule("users");
  const canWrite = canWriteModule(user.roleKeys, "users");

  const [users, roles] = await Promise.all([listUsersWithRoles(), listRoles()]);

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
      <UsersTable
        users={users}
        roles={roles}
        canWrite={canWrite}
        currentUserId={user.userId}
      />
    </>
  );
}
