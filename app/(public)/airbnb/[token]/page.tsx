import { notFound } from "next/navigation";
import { getAirbnbGuest } from "@/lib/guest/airbnb";
import { listAirbnbExtras, listAirbnbRequests } from "@/lib/airbnb/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { AirbnbPortal } from "@/components/guest/airbnb-portal";

export const metadata = { title: "My Booking" };
export const dynamic = "force-dynamic";

export default async function AirbnbGuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await getAirbnbGuest(token);
  if (!booking) notFound();

  // Fetch lease id from token to load extras / requests (public page — admin client)
  const admin = createAdminClient();
  const { data: lease } = await admin.from("leases").select("id").eq("portal_token", token).maybeSingle();
  const leaseId = (lease?.id as string | null) ?? null;

  const [extras, requests] = await Promise.all([
    listAirbnbExtras(true),
    leaseId ? listAirbnbRequests(leaseId) : Promise.resolve([]),
  ]);

  // Pending cleaning request the guest can cancel
  const pendingCleaning = requests.find((r) => r.requestType === "cleaning" && r.status === "pending") ?? null;

  return (
    <main className="flex min-h-screen items-start justify-center bg-transparent px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <span aria-hidden className="text-3xl">☀️</span>
            <p className="mt-2 text-sm font-semibold text-stone-500">{APP_BRAND_SHORT}</p>
            <h1 className="mt-1 text-lg font-bold text-stone-900">Unit {booking.unitNumber}</h1>
            <p className="text-sm text-stone-600">{booking.guest} · {booking.propertyName}</p>
          </div>
          <div className="mt-5">
            <AirbnbPortal booking={booking} extras={extras} pendingCleaningId={pendingCleaning?.id ?? null} />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-stone-500">{APP_BRAND}</p>
      </div>
    </main>
  );
}
