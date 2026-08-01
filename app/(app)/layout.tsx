import { requireAuth } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { accessibleModules } from "@/lib/rbac/modules";
import { AppShell, type NavModule, type RoleOption } from "@/components/app-shell";

/**
 * Authenticated app shell. requireAuth() is the authoritative gate; the nav is
 * filtered to only the modules the signed-in role(s) may read.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  const modules: NavModule[] = accessibleModules(user.roleKeys).map((m) => ({
    key: m.key,
    path: m.path,
    label: m.label,
    blurb: m.blurb,
    milestone: m.milestone,
  }));

  // Resolve human role labels from the DB (roles are data, not constants).
  const supabase = await createClient();
  const { data: roleRows } = await supabase
    .from("roles")
    .select("role_key, label")
    .in("role_key", user.allRoleKeys.length ? user.allRoleKeys : ["__none__"]);

  const allRoleOptions: RoleOption[] = user.allRoleKeys.map((key) => ({
    key,
    label: roleRows?.find((r) => r.role_key === key)?.label ?? key,
  }));

  return (
    <AppShell
      modules={modules}
      displayLabel={user.displayLabel}
      allRoleOptions={allRoleOptions}
      actingAs={user.actingAs}
    >
      {children}
    </AppShell>
  );
}
