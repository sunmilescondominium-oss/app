import Link from "next/link";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { MODULES, ROLE_GROUPS } from "@/lib/rbac/modules";
import { getModuleRoleOverrides } from "./actions";
import { PageHeader } from "@/components/ui";
import { RolePermissionMatrix } from "@/components/admin/role-permission-matrix";

export const metadata = { title: "Role Permissions" };

export default async function RolePermissionsPage() {
  const user = await requireAuth();
  const isAdmin = userHasAnyRole(user, ["admin", "managing_officer", "consultant"]);
  if (!isAdmin) throw new Error("Access denied.");

  const canEdit = userHasAnyRole(user, ["admin", "managing_officer"]);
  const overrides = await getModuleRoleOverrides();
  const modules = Object.values(MODULES);

  return (
    <>
      <div className="mb-4">
        <Link href="/admin" className="text-sm font-medium text-amber-700 hover:underline">
          ← Admin
        </Link>
      </div>

      <PageHeader
        title="Role Permissions"
        subtitle="Module access by role group. Overrides are saved to the database — no deployment needed."
      />

      {/* Role groups reference */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_GROUPS.map((group) => (
          <div key={group.key} className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-xs font-semibold text-stone-700">{group.label}</p>
            <p className="mb-2 text-[10px] text-stone-400">{group.description}</p>
            <div className="flex flex-wrap gap-1">
              {(group.roles as string[]).map((r) => (
                <span key={r} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono text-stone-600">
                  {r}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-xs text-amber-800">
          <strong>Editing mode:</strong> Click a group header to expand individual roles. Click ON/OFF to toggle
          the whole group. Click individual checkboxes for per-role control. Violet ring = overridden from default.
          Click ↺ to revert a cell to its default.
        </div>
      )}

      <RolePermissionMatrix modules={modules} overrides={overrides} canEdit={canEdit} />
    </>
  );
}
