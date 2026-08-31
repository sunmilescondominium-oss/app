import { requireAuth } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { accessibleModules, SUPER_ROLES } from "@/lib/rbac/modules";
import { getFeatureFlags, MODULE_FLAG } from "@/lib/settings/flags";
import { AppShell, type NavModule, type RoleOption } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { navLabel, navBlurb } from "@/lib/i18n";
import { countUnreadNotifications, notifyPostdatedChecksDue } from "@/lib/notifications/queries";
import { countUnreadChat } from "@/lib/chat/queries";
import { demoableRoles } from "@/lib/auth/demo-hierarchy";

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

  // The "Act as / view as" switcher appears for canActAsAny users (all roles)
  // and for users with demo hierarchy access (their demoable roles only).
  const supabase = await createClient();
  const demoKeys = demoableRoles(user.allRoleKeys);
  const hasDemoAccess = demoKeys.length > 0;

  let allRoleOptions: RoleOption[] = [];
  if (user.canActAsAny) {
    const { data: roleRows } = await supabase
      .from("roles")
      .select("role_key, label, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    allRoleOptions = (roleRows ?? []).map((r) => ({
      key: r.role_key as string,
      label: (r.label as string) ?? (r.role_key as string),
    }));
  } else if (hasDemoAccess) {
    const { data: roleRows } = await supabase
      .from("roles")
      .select("role_key, label, sort_order")
      .in("role_key", demoKeys)
      .eq("is_active", true)
      .order("sort_order");
    allRoleOptions = (roleRows ?? []).map((r) => ({
      key: r.role_key as string,
      label: (r.label as string) ?? (r.role_key as string),
    }));
  }

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  void notifyPostdatedChecksDue(); // fire-and-forget — never blocks render
  const [unreadNotifications, unreadChat] = await Promise.all([
    countUnreadNotifications(user.userId, user.roleKeys),
    countUnreadChat(user.userId),
  ]);

  return (
    <AppShell
      modules={modules}
      displayLabel={user.displayLabel}
      allRoleOptions={allRoleOptions}
      actingAs={user.actingAs}
      impersonating={user.impersonating}
      demoMode={user.demoMode}
      lang={lang}
      commitSha={commitSha}
      isSuperUser={user.roleKeys.some((r) => ["consultant", "admin", "managing_officer"].includes(r))}
      unreadNotifications={unreadNotifications}
      unreadChat={unreadChat}
    >
      {children}
    </AppShell>
  );
}
