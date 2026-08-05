import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { listOutages, FALLBACK_AUTHORIZER_ROLES } from "@/lib/kiosk/fallback";
import { FallbackConsole } from "@/components/kiosk/fallback-console";
import { siteOrigin } from "@/lib/site-url";

export const metadata = { title: "Kiosk fallback access" };

export default async function KioskAccessPage() {
  const user = await requireModule("kiosk_fallback");
  const canApprove = userHasAnyRole(user, FALLBACK_AUTHORIZER_ROLES);
  const [outages, origin] = await Promise.all([listOutages(), siteOrigin()]);
  const active = outages.filter((o) => o.status === "active" || o.status === "pending").length;

  return (
    <>
      <Breadcrumb items={[{ label: "Kiosk fallback access" }]} />
      <PageHeader
        title="Kiosk fallback access"
        subtitle="When the on-site kiosk is down: request approved, time-boxed mobile clock-in for specific employees. Deactivate it once the kiosk is back."
        badge={<Badge tone={active > 0 ? "amber" : "green"}>{active} open</Badge>}
      />
      <FallbackConsole outages={outages} canApprove={canApprove} mobileUrl={`${origin}/mobile-clock`} />
    </>
  );
}
