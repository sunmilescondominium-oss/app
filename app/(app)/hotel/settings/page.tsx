import Link from "next/link";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { PrintTestPanel } from "./PrintTestPanel";

export const metadata = { title: "Hotel Settings" };

function SettingCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 border-b border-stone-100 pb-3">
        <p className="text-sm font-semibold text-stone-800">{title}</p>
        {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default async function HotelSettingsPage() {
  const user = await requireModule("hotel");
  const isSupervisor = userHasAnyRole(user, ["admin", "managing_officer", "hotel_rental_monitoring", "consultant", "accounting"]);

  if (!isSupervisor) {
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;
  }

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="Hotel Settings"
        subtitle="Printer setup, hardware testing, and configuration."
      />

      <div className="space-y-6">
        <SettingCard
          title="Bluetooth Thermal Printer"
          description="Connect and test the ESC/POS Bluetooth receipt printer (e.g. GOOJPRT PT-265). Requires Chrome or Edge."
        >
          <PrintTestPanel />
        </SettingCard>

        <SettingCard
          title="Printer Notes"
          description="Tips for reliable printing."
        >
          <ul className="space-y-2 text-xs text-stone-600">
            <li className="flex gap-2">
              <span className="text-stone-400">1.</span>
              <span><strong>Pair first</strong> — turn on the printer and pair it in your device&apos;s Bluetooth settings before opening this page. The device picker only shows already-paired printers.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-stone-400">2.</span>
              <span><strong>Chrome or Edge only</strong> — Web Bluetooth is not supported in Firefox, Safari, or iOS Chrome.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-stone-400">3.</span>
              <span><strong>Paper loaded</strong> — the printer may silently succeed even with no paper. Always load paper before testing.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-stone-400">4.</span>
              <span><strong>Stay on the page</strong> — the Bluetooth connection is session-scoped. Navigating away will disconnect the printer; staff will need to reconnect on the folio page.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-stone-400">5.</span>
              <span><strong>Nothing found?</strong> — If the device picker shows no printers, unpair and re-pair the printer in OS Bluetooth settings, then try again.</span>
            </li>
          </ul>
        </SettingCard>

        <SettingCard
          title="Print a Guest Folio"
          description="To print a receipt for a specific guest stay, open the folio from the room board and use the Print Folio button there."
        >
          <Link
            href="/hotel"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700 hover:border-amber-300 hover:text-amber-800"
          >
            ← Go to room board
          </Link>
        </SettingCard>
      </div>
    </>
  );
}
