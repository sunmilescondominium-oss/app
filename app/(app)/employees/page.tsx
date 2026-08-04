import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { canWriteModule, LEAVE_APPROVER_ROLES } from "@/lib/rbac/modules";
import { employeeList, listLeave } from "@/lib/employees/queries";
import { listRoles } from "@/lib/users/queries";
import { analyzeLeave } from "@/lib/employees/leave-analysis";
import { AddEmployee } from "@/components/employees/add-employee";
import { TableSearch } from "@/components/table-search";
import { AdjustableColumns } from "@/components/adjustable-columns";
import { getKioskSettings } from "@/lib/kiosk/settings";
import { KioskSettingsPanel } from "@/components/employees/kiosk-settings";
import { peso } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { Avatar } from "@/components/employees/avatar";
import { PhotoUpload } from "@/components/employees/photo-upload";
import { CredentialSetter } from "@/components/employees/credential-setter";
import { QrControl } from "@/components/employees/qr-control";
import { PendingLeave } from "@/components/employees/pending-leave";

export const metadata = { title: "Employees" };

const roleLabel = (k: string) => k.replace(/_/g, " ");

export default async function EmployeesPage() {
  const user = await requireModule("employees");
  const canWrite = canWriteModule(user.roleKeys, "employees");
  const canDecide = userHasAnyRole(user, LEAVE_APPROVER_ROLES);

  const [employees, pending, kiosk, allRoles] = await Promise.all([employeeList(), listLeave("pending"), getKioskSettings(), canWrite ? listRoles() : Promise.resolve([])]);
  const staffRoles = allRoles.filter((r) => r.is_staff).map((r) => ({ key: r.role_key, label: r.label }));
  const items = await Promise.all(
    pending.map(async (req) => ({
      req,
      conflict:
        req.category === "leave" || req.category === "ob"
          ? await analyzeLeave({ userId: req.user_id, start_date: req.start_date, end_date: req.end_date })
          : null,
    })),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
        backHref="/dashboard" title="Employees" subtitle="Staff roster, photos & leave approvals." />
        <a
          href="/attendance-portal"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Open attendance kiosk ↗
        </a>
      </div>

      {canWrite && (
        <div className="mt-3 space-y-3">
          <AddEmployee roles={staffRoles} />
          <KioskSettingsPanel accessCode={kiosk.accessCode} showPhotos={kiosk.showPhotos} />
        </div>
      )}

      <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Pending leave {items.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{items.length}</span>}
      </h2>
      <div className="mb-6">
        <PendingLeave items={items} canDecide={canDecide} />
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Roster</h2>
      <TableSearch placeholder="Search staff by name, role, ID…">
      <AdjustableColumns storageKey="employees">
      <div className="table-wrap">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3 text-right">Daily rate</th>
              <th className="px-4 py-3">Status</th>
              {canWrite && <th className="px-4 py-3 text-right">Kiosk ID</th>}
              {canWrite && <th className="px-4 py-3 text-right">Photo</th>}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar id={e.id} label={e.label} photoPath={e.photoPath} />
                    <div>
                      <Link href={`/employees/${e.id}`} className="font-medium text-amber-700 hover:underline">{e.label}</Link>
                      <p className="text-xs text-stone-400">{e.email ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {e.roleKeys.length === 0 && <span className="text-xs text-stone-400">—</span>}
                    {e.roleKeys.map((r) => (
                      <span key={r} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] capitalize text-stone-600">
                        {roleLabel(r)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{e.dailyRate ? peso(e.dailyRate) : "—"}</td>
                <td className="px-4 py-2.5">
                  {e.active ? (
                    <span className="text-emerald-600">Active</span>
                  ) : (
                    <span className="text-stone-400">Inactive</span>
                  )}
                </td>
                {canWrite && (
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col items-end gap-1.5">
                      <CredentialSetter userId={e.id} employeeNo={e.employeeNo} hasPasscode={e.hasPasscode} canEditId={user.allRoleKeys.includes("consultant")} />
                      <QrControl userId={e.id} label={e.label} qrToken={e.qrToken} />
                    </div>
                  </td>
                )}
                {canWrite && (
                  <td className="px-4 py-2.5 text-right">
                    <PhotoUpload userId={e.id} hasPhoto={!!e.photoPath} />
                  </td>
                )}
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
