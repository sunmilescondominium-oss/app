import { requireAuth } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { accessibleModules } from "@/lib/rbac/modules";
import { getFeatureFlags, MODULE_FLAG } from "@/lib/settings/flags";
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

  const flags = await getFeatureFlags();
  const modules: NavModule[] = accessibleModules(user.roleKeys)
    .filter((m) => {
      const flag = MODULE_FLAG[m.key];
      return !flag || (flags.get(flag) ?? false);
    })
    .map((m) => ({
      key: m.key,
      path: m.path,
      label: m.label,
      blurb: m.blurb,
      milestone: m.milestone,
    }));

  // Resolve human role labels from the DB (roles are data, not constants).
  // Admins may preview ANY active role; everyone else only the roles they hold.
  const supabase = await createClient();
  const rolesQuery = supabase.from("roles").select("role_key, label, sort_order").eq("is_active", true).order("sort_order");
  const { data: roleRows } = user.canActAsAny
    ? await rolesQuery
    : await rolesQuery.in("role_key", user.allRoleKeys.length ? user.allRoleKeys : ["__none__"]);

  const allRoleOptions: RoleOption[] = (roleRows ?? []).map((r) => ({
    key: r.role_key as string,
    label: (r.label as string) ?? (r.role_key as string),
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
