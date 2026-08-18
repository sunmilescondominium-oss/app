import Link from "next/link";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Admin" };

const ADMIN_SECTIONS = [
  {
    href: "/admin/collection-items",
    title: "Collection Item Types",
    blurb: "Define what can be collected — parking, utility, rent, hotel room, etc. Staff see only these items when entering collections.",
    icon: "📋",
    roles: ["accounting", "admin", "managing_officer", "consultant"],
  },
  {
    href: "/admin/bank-config",
    title: "Bank Deposit Config",
    blurb: "Set which bank each collection category deposits to, and the allowed items per deposit.",
    icon: "🏦",
    roles: ["accounting", "admin", "managing_officer", "consultant"],
  },
  {
    href: "/admin/role-permissions",
    title: "Role Permissions",
    blurb: "Granular module access control by role group. Overrides are DB-driven — no deployment needed.",
    icon: "🔐",
    roles: ["admin", "managing_officer", "consultant"],
  },
  {
    href: "/admin/rate-cards",
    title: "Unit Rate Cards",
    blurb: "Monthly billing items per unit for rental, condo, airbnb, and parking.",
    icon: "💳",
    roles: ["accounting", "admin", "managing_officer", "consultant"],
  },
  {
    href: "/admin/settings",
    title: "App Settings",
    blurb: "Global system settings: operating timezone, and other location-specific configuration.",
    icon: "⚙️",
    roles: ["admin", "managing_officer"],
  },
  {
    href: "/admin/health",
    title: "System Health",
    blurb: "Connectivity, configuration, free tier usage, and error log. Copy diagnostics to share with your developer.",
    icon: "🩺",
    roles: ["admin", "managing_officer", "consultant"],
  },
] as const;

export default async function AdminPage() {
  const user = await requireAuth();
  const isAdmin = userHasAnyRole(user, ["admin", "managing_officer", "accounting", "consultant"]);
  if (!isAdmin) throw new Error("Access denied.");

  const visible = ADMIN_SECTIONS.filter((s) =>
    (s.roles as readonly string[]).some((r) => user.roleKeys.includes(r)),
  );

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="System configuration and access management."
        backHref="/dashboard"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
          >
            <span className="text-2xl">{s.icon}</span>
            <p className="font-semibold text-stone-800">{s.title}</p>
            <p className="text-xs text-stone-500 leading-relaxed">{s.blurb}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
