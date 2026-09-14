"use client";

import { type ReactNode, useState } from "react";
import { BluetoothPrinter, bluetoothSupported } from "@/lib/printing/bluetooth-printer";
import type { FolioData } from "@/lib/printing/format-folio";

type PrintStatus = "idle" | "connecting" | "printing" | "done" | "error";

/** Wraps the receipt content with a 58mm/80mm width toggle and a Bluetooth
 *  print button. Pass `folioData` to enable BLE printing; omit for CSS-only. */
export function ReceiptFrame({
  children,
  folioData,
}: {
  children: ReactNode;
  folioData?: FolioData;
}) {
  const [w, setW] = useState<"58" | "80">("58");
  const [status, setStatus] = useState<PrintStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [printer] = useState(() => new BluetoothPrinter());

  const btn = (v: "58" | "80") =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium ${
      w === v ? "border-amber-400 bg-amber-50 text-amber-800" : "border-stone-300 text-stone-600"
    }`;

  const busy = status === "connecting" || status === "printing";

  async function handleBlePrint() {
    if (!folioData) return;
    setErrorMsg("");
    try {
      if (!printer.connected) {
        setStatus("connecting");
        await printer.connect();
      }
      setStatus("printing");
      const { formatFolio } = await import("@/lib/printing/format-folio");
      const bytes = formatFolio(folioData);
      await printer.print(bytes);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  const printLabel =
    status === "connecting" ? "Connecting…" :
    status === "printing"   ? "Printing…" :
    status === "done"       ? "✓ Printed" :
    status === "error"      ? "⚠ Retry" :
    "🖨 Print receipt";

  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-stone-500">Receipt width:</span>
        <button type="button" onClick={() => setW("58")} className={btn("58")}>58mm</button>
        <button type="button" onClick={() => setW("80")} className={btn("80")}>80mm</button>

        {folioData ? (
          bluetoothSupported() ? (
            <div className="flex flex-col items-start gap-0.5">
              <button
                type="button"
                onClick={handleBlePrint}
                disabled={busy}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  status === "done"  ? "bg-emerald-600 text-white" :
                  status === "error" ? "bg-rose-600 text-white hover:bg-rose-700" :
                  "bg-amber-600 text-white hover:bg-amber-700"
                }`}
              >
                {printLabel}
              </button>
              {status === "error" && errorMsg && (
                <p className="text-xs text-rose-600 max-w-xs">{errorMsg}</p>
              )}
              {status === "idle" && !printer.connected && (
                <p className="text-[10px] text-stone-400">Requires Chrome + Bluetooth printer</p>
              )}
              {printer.connected && status === "idle" && (
                <button
                  type="button"
                  onClick={() => { printer.disconnect(); setStatus("idle"); setErrorMsg(""); }}
                  className="text-[10px] text-stone-400 hover:text-stone-600 underline"
                >
                  Disconnect printer
                </button>
              )}
            </div>
          ) : (
            <span className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs text-stone-400 cursor-not-allowed">
              🖨 Bluetooth not available
            </span>
          )
        ) : (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Print receipt
          </button>
        )}
      </div>

      <div
        className="mx-auto rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-tight text-stone-900 print:rounded-none print:border-0 print:p-0 print:mx-0"
        style={{ width: w === "58" ? "58mm" : "80mm" }}
      >
        {children}
      </div>
    </div>
  );
}
