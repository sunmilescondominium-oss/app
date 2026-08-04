import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listTenants } from "@/lib/rentals/queries";
import { peso } from "@/lib/collections/summary";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";

export const metadata = { title: "Tenants" };

const LINE_TONE: Record<string, "blue" | "indigo"> = { rental: "blue", airbnb: "indigo" };

export default async function TenantsPage() {
  await requireModule("rentals");
  const tenants = await listTenants();

  return (
    <>
      <Breadcrumb items={[{ label: "Rentals & Airbnb", href: "/rentals" }, { label: "Tenants" }]} />
      <PageHeader
        title="Tenants"
        subtitle="Everyone currently occupying a rental or Airbnb unit."
        badge={<Badge tone="green">{tenants.length} active</Badge>}
      />

      <div className="table-wrap">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3 text-right">Rent</th>
              <th className="px-4 py-3">Since</th>
              <th className="px-4 py-3">Portal</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">No active tenants. Start a lease from a unit in Rentals & Airbnb.</td></tr>
            )}
            {tenants.map((t) => (
              <tr key={t.leaseId} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-stone-800">{t.tenantLabel}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/rentals/${t.unitId}`} className="text-amber-700 hover:underline">{t.unitNumber}</Link>
                  {t.propertyName && <span className="block text-xs text-stone-400">{t.propertyName}</span>}
                </td>
                <td className="px-4 py-2.5"><Badge tone={LINE_TONE[t.businessLine] ?? "slate"}>{t.businessLine}</Badge></td>
                <td className="px-4 py-2.5 text-stone-500">{t.contact ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(t.rentAmount)}<span className="text-xs text-stone-400">/{t.billingCycle === "nightly" ? "night" : "mo"}</span></td>
                <td className="px-4 py-2.5 text-stone-500">{t.startDate}</td>
                <td className="px-4 py-2.5">{t.hasPin ? <span className="text-emerald-700">PIN set ✓</span> : <span className="text-stone-400">no PIN</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-stone-400">Whoever is entered on a rental/Airbnb unit is a tenant. They view their bills through the renter portal using their unit # + PIN (set the PIN on the unit&rsquo;s detail page).</p>
    </>
  );
}
