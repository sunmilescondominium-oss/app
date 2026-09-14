"use client";

import { useState } from "react";
import { BluetoothPrinter, bluetoothSupported } from "@/lib/printing/bluetooth-printer";

type Status = "idle" | "connecting" | "printing" | "done" | "error";

const TEST_FOLIO = {
  brandName: "Sun Miles Hotel",
  roomNumber: "TEST-101",
  arNo: "AR-TEST-0001",
  guestLabel: "Test Guest",
  checkIn: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  checkOut: new Date().toISOString(),
  plannedHours: 2,
  stay: {
    base_rate: 500,
    base_hours: 2,
    planned_hours: 2,
    extra_hour_rate: 100,
    extra_hours: 0,
    extra_persons: 0,
    extra_person_rate: 0,
    extra_person_amount: 0,
    discount_amount: 0,
    promo_discount_amount: 0,
    tax_mode: "inclusive" as const,
    tax_rate: 0,
  },
  paid: 500,
  ordersTotal: 0,
  discountType: null,
  promoName: null,
  promoDiscountAmount: 0,
  extraPersons: 0,
  extraPersonRate: 0,
  taxAmount: 0,
  taxLabel: null,
  payments: [{ amount: 500, method: "cash", ar_no: "AR-TEST-0001", or_no: "OR-TEST-0001", created_at: new Date().toISOString() }],
  orders: [],
  qrUrl: null,
};

export function PrintTestPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [printer] = useState(() => new BluetoothPrinter());

  if (!bluetoothSupported()) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Bluetooth Not Available</p>
        <p className="mt-1 text-xs text-amber-700">
          Web Bluetooth requires Chrome or Edge on Windows/Android/macOS. Firefox, Safari, and iOS Chrome are not supported.
        </p>
      </div>
    );
  }

  async function handleTest() {
    setErrorMsg("");
    try {
      if (!printer.connected) {
        setStatus("connecting");
        await printer.connect();
      }
      setStatus("printing");
      const { formatFolio } = await import("@/lib/printing/format-folio");
      const bytes = formatFolio(TEST_FOLIO);
      await printer.print(bytes);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function handleDisconnect() {
    printer.disconnect();
    setStatus("idle");
    setErrorMsg("");
  }

  const busy = status === "connecting" || status === "printing";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">
        <p className="font-semibold text-stone-700 mb-1">What this prints</p>
        <p>A sample hotel folio receipt for room <span className="font-mono">TEST-101</span> with a PHP 500 room charge. Use this to verify the printer is connected and paper is loaded before going live with guests.</p>
      </div>

      {printer.connected && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          <span className="text-xs text-emerald-800 font-medium">Printer connected</span>
          <button
            type="button"
            onClick={handleDisconnect}
            className="ml-auto text-xs text-stone-400 hover:text-stone-600 underline"
          >
            Disconnect
          </button>
        </div>
      )}

      {status === "error" && errorMsg && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{errorMsg}</p>
      )}

      <button
        type="button"
        onClick={handleTest}
        disabled={busy}
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          status === "done"
            ? "bg-emerald-600 text-white"
            : status === "error"
            ? "bg-rose-600 text-white hover:bg-rose-700"
            : "bg-amber-600 text-white hover:bg-amber-700"
        }`}
      >
        <span>🖨</span>
        {status === "connecting" ? "Connecting to printer…" :
         status === "printing"   ? "Printing test receipt…" :
         status === "done"       ? "✓ Test receipt printed" :
         status === "error"      ? "Retry test print" :
         "Print test receipt"}
      </button>

      {status === "idle" && !printer.connected && (
        <p className="text-xs text-stone-400">
          First click will open the browser&apos;s Bluetooth device picker — select your thermal printer from the list.
        </p>
      )}
    </div>
  );
}
