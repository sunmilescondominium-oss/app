import { requireModule } from "@/lib/auth/dal";
import { canWriteModule, canInviteUsers } from "@/lib/rbac/modules";
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
import { serverEnv } from "@/lib/env";

export const metadata = { title: "Users & Roles" };

export default async function UsersPage() {
  const user = await requireModule("users");
  const canWrite = canWriteModule(user.roleKeys, "users");
  const canInvite = canInviteUsers(user.allRoleKeys);
  const mail = { driver: serverEnv.alertDriver, smtpUser: Boolean(serverEnv.smtpUser), smtpPass: Boolean(serverEnv.smtpPass), resendKey: Boolean(serverEnv.resendApiKey) };
  const mailReady = mail.driver === "smtp" ? mail.smtpUser && mail.smtpPass : mail.driver === "resend" ? mail.resendKey : true;

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

      {canInvite && (
        <div className={`mb-4 rounded-xl border px-4 py-2.5 text-xs ${mailReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
          <span className="font-semibold">Email transport:</span> driver=<code className="font-mono">{mail.driver}</code>
          {" · "}Gmail user {mail.smtpUser ? "✓" : "✗"} · app password {mail.smtpPass ? "✓" : "✗"} · Resend key {mail.resendKey ? "✓" : "✗"}
          {!mailReady && (
            <span className="mt-1 block font-medium">
              For the custom welcome email, set <code className="font-mono">ALERT_EMAIL_DRIVER=smtp</code> plus <code className="font-mono">SMTP_USER</code> and <code className="font-mono">SMTP_PASS</code> in the server env, then redeploy. Until then invites fall back to Supabase&apos;s generic email.
            </span>
          )}
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
            canInvite={canInvite}
            currentUserId={user.userId}
            canImpersonate={user.allRoleKeys.includes("consultant")}
            canHardDelete={["consultant", "admin"].some((r) => user.allRoleKeys.includes(r))}
          />
        </AdjustableColumns>
      </TableSearch>
    </>
  );
}
