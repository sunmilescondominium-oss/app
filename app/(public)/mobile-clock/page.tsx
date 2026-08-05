import { APP_BRAND_SHORT, APP_BRAND } from "@/lib/config";
import { DigitalClock } from "@/components/kiosk/digital-clock";
import { MobileClock } from "@/components/kiosk/mobile-clock";

export const metadata = { title: "Mobile Attendance (Kiosk Down)" };
export const dynamic = "force-dynamic";

export default function MobileClockPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <header className="mb-4 text-center">
        <h1 className="text-xl font-bold text-stone-900">{APP_BRAND_SHORT}</h1>
        <p className="text-sm text-stone-600">Mobile Attendance — kiosk backup</p>
      </header>
      <div className="mb-4">
        <DigitalClock />
      </div>
      <MobileClock />
      <p className="mt-6 text-center text-xs text-stone-400">
        This backup is only for when the on-site kiosk is unavailable and access has been approved. {APP_BRAND}
      </p>
    </div>
  );
}
