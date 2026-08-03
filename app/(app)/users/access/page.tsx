import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { listRoles } from "@/lib/users/queries";
import { MODULE_LIST, effectivePermission, GRANT_ROLES } from "@/lib/rbac/modules";
import { PageHeader, Badge } from "@/components/ui";
import { PermissionEditor, type ModuleRow } from "@/components/users/permission-editor";

export const metadata = { title: "Access Control" };

export default async function AccessControlPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  // Access-granting is its own capability (admin / owner / consultant /
  // managing officer) — not the Users module — so top roles can manage it.
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...GRANT_ROLES])) redirect("/no-access");

  const roles = (await listRoles()).map((r) => ({ key: r.role_key, label: r.label }));
  const { role } = await searchParams;
  const selectedRole = role && roles.some((r) => r.key === role) ? role : roles[0]?.key ?? "";

  // effectivePermission is override-aware because the DAL already loaded the
  // overrides for this request.
  const modules: ModuleRow[] = MODULE_LIST.map((m) => {
    const eff = effectivePermission(selectedRole, m.key);
    return { key: m.key, label: m.label, blurb: m.blurb, read: eff.read, write: eff.write };
  });

  return (
    <>
      <div className="mb-2"><Link href="/users" className="text-sm text-indigo-700 hover:underline">← Users & Roles</Link></div>
      <PageHeader
        title="Access Control"
        subtitle="Grant each role read/write per module. Overrides the built-in defaults — no code change needed."
        badge={<Badge tone="green">Granular</Badge>}
      />
      <PermissionEditor roles={roles} selectedRole={selectedRole} modules={modules} />
    </>
  );
}
