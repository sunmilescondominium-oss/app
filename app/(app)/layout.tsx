import { requireAuth } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { accessibleModules, SUPER_ROLES } from "@/lib/rbac/modules";
import { getFeatureFlags, MODULE_FLAG } from "@/lib/settings/flags";
import { AppShell, type NavModule, type RoleOption } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { navLabel, navBlurb } from "@/lib/i18n";

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
  const lang = await getLang();

  const flags = await getFeatureFlags();
  const superUser = user.roleKeys.some((r) => SUPER_ROLES.includes(r));
  const modules: NavModule[] = accessibleModules(user.roleKeys)
    .filter((m) => {
      const flag = MODULE_FLAG[m.key];
      return !flag || superUser || (flags.get(flag) ?? false);
    })
    .map((m) => ({
      key: m.key,
      path: m.path,
      label: navLabel(lang, m.key, m.label),
      blurb: navBlurb(lang, m.key, m.blurb),
      milestone: m.milestone,
    }));

  // The "Act as / view as" switcher only appears for holders of the capability
  // (owner/admin/consultant by default, or roles granted it). They may preview
  // any active role.
  const supabase = await createClient();
  const { data: roleRows } = user.canActAsAny
    ? await supabase.from("roles").select("role_key, label, sort_order").eq("is_active", true).order("sort_order")
    : { data: [] };

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
      impersonating={user.impersonating}
      lang={lang}
    >
      {children}
    </AppShell>
  );
}
