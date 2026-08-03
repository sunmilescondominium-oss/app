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

  // Capability summary — which roles can view evidence / act as another role.
  const mediaRoles = roles.filter((r) => effectivePermission(r.key, "media").read);
  const actasRoles = roles.filter((r) => effectivePermission(r.key, "actas").read);

  const Chips = ({ items }: { items: { key: string; label: string }[] }) =>
    items.length ? (
      <div className="flex flex-wrap gap-1.5">
        {items.map((r) => (
          <span key={r.key} className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200">{r.label}</span>
        ))}
      </div>
    ) : (
      <p className="text-xs text-stone-400">No roles.</p>
    );

  return (
    <>
      <div className="mb-2"><Link href="/users" className="text-sm text-indigo-700 hover:underline">← Users & Roles</Link></div>
      <PageHeader
        title="Access Control"
        subtitle="Grant each role read/write per module. Overrides the built-in defaults — no code change needed."
        badge={<Badge tone="green">Granular</Badge>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
          <p className="mb-2 text-sm font-semibold text-stone-700">📷 Can view photo/video evidence</p>
          <Chips items={mediaRoles} />
        </div>
        <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
          <p className="mb-2 text-sm font-semibold text-stone-700">🎭 Can “act as / view as” another role</p>
          <Chips items={actasRoles} />
        </div>
      </div>

      <PermissionEditor roles={roles} selectedRole={selectedRole} modules={modules} />
    </>
  );
}
