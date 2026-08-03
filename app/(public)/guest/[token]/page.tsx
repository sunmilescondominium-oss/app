import { notFound } from "next/navigation";
import { getGuestStay } from "@/lib/guest/queries";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { GuestPortal } from "@/components/guest/guest-portal";

export const metadata = { title: "My Stay" };
export const dynamic = "force-dynamic";

export default async function GuestPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const stay = await getGuestStay(token);
  if (!stay) notFound();

  return (
    <main className="flex min-h-screen items-start justify-center bg-stone-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <span aria-hidden className="text-3xl">☀️</span>
            <p className="mt-2 text-sm font-semibold text-stone-500">{APP_BRAND_SHORT}</p>
            <h1 className="mt-1 text-lg font-bold text-stone-900">Room {stay.unitNumber}</h1>
            <p className="text-sm text-stone-600">{stay.guest}</p>
          </div>
          <div className="mt-5">
            <GuestPortal stay={stay} />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-stone-500">{APP_BRAND}</p>
      </div>
    </main>
  );
}
