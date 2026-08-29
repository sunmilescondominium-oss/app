"use client";

import { useState } from "react";
import { BluetoothPrinter, bluetoothSupported } from "@/lib/printing/bluetooth-printer";
import type { FolioData } from "@/lib/printing/format-folio";

type Status = "idle" | "connecting" | "printing" | "done" | "error";

export function BluetoothPrintButton({ folioData }: { folioData: FolioData }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const printerRef = useState<BluetoothPrinter>(() => new BluetoothPrinter())[0];

  if (!bluetoothSupported()) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-xs text-stone-400 cursor-not-allowed select-none">
        🖨 Bluetooth not available
      </span>
    );
  }

  async function handlePrint() {
    setErrorMsg("");
    try {
      if (!printerRef.connected) {
        setStatus("connecting");
        await printerRef.connect();
      }
      setStatus("printing");
      // Dynamic import so format-folio + esc-pos are only loaded client-side
      const { formatFolio } = await import("@/lib/printing/format-folio");
      const bytes = formatFolio(folioData);
      await printerRef.print(bytes);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function handleDisconnect() {
    printerRef.disconnect();
    setStatus("idle");
    setErrorMsg("");
  }

  const label =
    status === "connecting" ? "Connecting…" :
    status === "printing"   ? "Printing…" :
    status === "done"       ? "✓ Printed" :
    "🖨 Print Folio";

  const busy = status === "connecting" || status === "printing";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {printerRef.connected && status === "idle" && (
          <button
            type="button"
            onClick={handleDisconnect}
            className="text-xs text-stone-400 hover:text-stone-600 underline"
          >
            Disconnect printer
          </button>
        )}
        <button
          type="button"
          onClick={handlePrint}
          disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            status === "done"
              ? "bg-emerald-600 text-white"
              : status === "error"
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "bg-amber-600 text-white hover:bg-amber-700"
          }`}
        >
          {status === "error" ? "⚠ Retry Print" : label}
        </button>
      </div>
      {status === "error" && errorMsg && (
        <p className="text-xs text-rose-600 max-w-xs text-right">{errorMsg}</p>
      )}
      {status === "idle" && !printerRef.connected && (
        <p className="text-[10px] text-stone-400">Requires Chrome + Bluetooth</p>
      )}
    </div>
  );
}
