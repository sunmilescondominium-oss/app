import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { RepairForm } from "@/components/portal/repair-form";

export const metadata = { title: "Repair Request" };

/** Public repair-request portal (no login) for tenants and hotel guests. */
export default function RepairRequestPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <span aria-hidden className="text-3xl">
              🛠️
            </span>
            <p className="mt-2 text-sm font-semibold text-stone-500">{APP_BRAND_SHORT}</p>
            <h1 className="mt-2 text-xl font-bold text-stone-900">Submit a Repair Request</h1>
            <p className="mt-1 text-sm text-stone-600">
              Report an issue and we&apos;ll track it from submitted to completed.
            </p>
          </div>
          <div className="mt-6">
            <RepairForm />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-stone-500">{APP_BRAND}</p>
      </div>
    </main>
  );
}
