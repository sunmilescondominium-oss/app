import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/dal";
import { accessibleModules } from "@/lib/rbac/modules";

/**
 * Entry point. Sends the visitor to login, or to the first module their
 * role(s) can access, or to /no-access if their roles grant no dashboard.
 */
export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const modules = accessibleModules(user.roleKeys);
  redirect(modules[0]?.path ?? "/no-access");
}
