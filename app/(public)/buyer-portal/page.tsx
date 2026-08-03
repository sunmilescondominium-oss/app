import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { BuyerLookup } from "@/components/portal/buyer-lookup";

export const metadata = { title: "Buyer Portal" };

/** Public buyer self-service portal (no Supabase Auth — unit# + PIN). Read-only. */
export default function BuyerPortalPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <span aria-hidden className="text-3xl">
              ☀️
            </span>
            <p className="mt-2 text-sm font-semibold text-stone-500">{APP_BRAND_SHORT}</p>
            <h1 className="mt-2 text-xl font-bold text-stone-900">Buyer Self-Service</h1>
            <p className="mt-1 text-sm text-stone-600">
              Check your balance, next due date, and payment history with your unit
              number and reference PIN.
            </p>
          </div>
          <div className="mt-6">
            <BuyerLookup />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-stone-500">{APP_BRAND}</p>
      </div>
    </main>
  );
}
