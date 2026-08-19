import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import {
  listAirbnbRatePlans, listAirbnbExtras, getAirbnbTaxSettings,
  getRentalTaxSettings, listUtilityRates,
} from "@/lib/airbnb/queries";
import { RatePlansPanel } from "./rate-plans-panel";
import { ExtrasPanel } from "./extras-panel";
import { TaxPanel } from "./tax-panel";
import { UtilityRatesPanel } from "./utility-rates-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rental & AirBnB Settings" };

export default async function RentalsSettingsPage() {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "managing_officer", "hotel_rental_monitoring", "consultant", "accounting"])) {
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;
  }

  const canWrite = userHasAnyRole(user, ["admin", "managing_officer", "hotel_rental_monitoring"]);

  const [ratePlans, extras, airbnbTax, rentalTax, utilityRates] = await Promise.all([
    listAirbnbRatePlans(),
    listAirbnbExtras(),
    getAirbnbTaxSettings(),
    getRentalTaxSettings(),
    listUtilityRates(),
  ]);

  return (
    <>
      <PageHeader
        backHref="/rentals"
        title="Rental & AirBnB Settings"
        subtitle="Rate plans, extras menu, tax, and utility rates."
      />

      <div className="space-y-6">
        <RatePlansPanel plans={ratePlans} canWrite={canWrite} />
        <ExtrasPanel extras={extras} canWrite={canWrite} />
        <TaxPanel airbnbTax={airbnbTax} rentalTax={rentalTax} canWrite={canWrite} />
        <UtilityRatesPanel rates={utilityRates} canWrite={canWrite} />
      </div>
    </>
  );
}
