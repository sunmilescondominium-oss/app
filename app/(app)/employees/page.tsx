import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { canWriteModule, LEAVE_APPROVER_ROLES } from "@/lib/rbac/modules";
import { employeeList, listLeave } from "@/lib/employees/queries";
import { analyzeLeave } from "@/lib/employees/leave-analysis";
import { peso } from "@/lib/collections/summary";
import { PageHeader } from "@/components/ui";
import { Avatar } from "@/components/employees/avatar";
import { PhotoUpload } from "@/components/employees/photo-upload";
import { CredentialSetter } from "@/components/employees/credential-setter";
import { PendingLeave } from "@/components/employees/pending-leave";

export const metadata = { title: "Employees" };

const roleLabel = (k: string) => k.replace(/_/g, " ");

export default async function EmployeesPage() {
  const user = await requireModule("employees");
  const canWrite = canWriteModule(user.roleKeys, "employees");
  const canDecide = userHasAnyRole(user, LEAVE_APPROVER_ROLES);

  const [employees, pending] = await Promise.all([employeeList(), listLeave("pending")]);
  const items = await Promise.all(
    pending.map(async (req) => ({ req, conflict: await analyzeLeave({ userId: req.user_id, start_date: req.start_date }) })),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Employees" subtitle="Staff roster, photos & leave approvals." />
        <a
          href="/attendance-portal"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open attendance kiosk ↗
        </a>
      </div>

      <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Pending leave {items.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{items.length}</span>}
      </h2>
      <div className="mb-6">
        <PendingLeave items={items} canDecide={canDecide} />
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Roster</h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
              <tr key={e.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar id={e.id} label={e.label} photoPath={e.photoPath} />
                    <div>
                      <p className="font-medium text-slate-800">{e.label}</p>
                      <p className="text-xs text-slate-400">{e.email ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {e.roleKeys.length === 0 && <span className="text-xs text-slate-400">—</span>}
                    {e.roleKeys.map((r) => (
                      <span key={r} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-600">
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
                    <span className="text-slate-400">Inactive</span>
                  )}
                </td>
                {canWrite && (
                  <td className="px-4 py-2.5 text-right">
                    <CredentialSetter userId={e.id} employeeNo={e.employeeNo} hasPasscode={e.hasPasscode} />
                  </td>
                )}
                {canWrite && (
                  <td className="px-4 py-2.5 text-right">
                    <PhotoUpload userId={e.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
