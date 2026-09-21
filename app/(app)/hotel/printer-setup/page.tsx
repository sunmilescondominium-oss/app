import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { PrinterSetupPanel } from "@/components/hotel/printer-setup-panel";

export const metadata = { title: "Printer Setup" };

export default async function PrinterSetupPage() {
  const user = await requireModule("hotel");
  const canAccess = userHasAnyRole(user, [
    "hotel_cashier",
    "admin",
    "managing_officer",
    "hotel_rental_monitoring",
    "consultant",
    "accounting",
  ]);

  if (!canAccess) {
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;
  }

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="Printer Setup"
        subtitle="Connect your Bluetooth thermal printer and adjust receipt settings."
      />

      <div className="max-w-xl">
        <PrinterSetupPanel />

        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-stone-700">Tips</p>
          <ul className="space-y-2 text-xs text-stone-600">
            <li className="flex gap-2">
              <span className="text-stone-400">1.</span>
              <span><strong>Pair first</strong> — turn on the printer and pair it in Bluetooth settings before connecting here. The browser picker only shows already-paired printers.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-stone-400">2.</span>
              <span><strong>Chrome or Edge only</strong> — Web Bluetooth is not supported in Firefox, Safari, or iOS Chrome.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-stone-400">3.</span>
              <span><strong>Settings are device-specific</strong> — paper width, feed lines, and QR size are saved on this device only. Adjust on each device that will be printing.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-stone-400">4.</span>
              <span><strong>Too much paper?</strong> — reduce Feed lines. The paper feeds that many blank lines before the cutter activates.</span>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
