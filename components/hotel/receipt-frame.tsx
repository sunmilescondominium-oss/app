"use client";

import { type ReactNode, useState, useEffect } from "react";
import { BluetoothPrinter, bluetoothSupported } from "@/lib/printing/bluetooth-printer";
import type { FolioData } from "@/lib/printing/format-folio";
import Link from "next/link";

type PrintStatus = "idle" | "connecting" | "printing" | "done" | "error";
type PaperWidth = "58" | "80";

const LS_WIDTH    = "receipt_paper_width";
const LS_FEED     = "receipt_feed_lines";
const LS_QR_SIZE  = "receipt_qr_size";

function lsGet(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}

export function ReceiptFrame({
  children,
  folioData,
}: {
  children: ReactNode;
  folioData?: FolioData;
}) {
  const [w, setWState]         = useState<PaperWidth>("58");
  const [feedLines, setFeedState] = useState(1);
  const [qrSize, setQrState]   = useState(6);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus]    = useState<PrintStatus>("idle");
  const [testStatus, setTestStatus] = useState<PrintStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [printer] = useState(() => new BluetoothPrinter());

  // Hydrate from localStorage after mount
  useEffect(() => {
    setWState((lsGet(LS_WIDTH, "58") as PaperWidth));
    setFeedState(parseInt(lsGet(LS_FEED, "1"), 10) || 1);
    setQrState(parseInt(lsGet(LS_QR_SIZE, "6"), 10) || 6);
  }, []);

  function setW(v: PaperWidth)    { setWState(v);          lsSet(LS_WIDTH, v); }
  function setFeed(v: number)     { setFeedState(v);       lsSet(LS_FEED, String(v)); }
  function setQr(v: number)       { setQrState(v);         lsSet(LS_QR_SIZE, String(v)); }

  const tabBtn = (v: PaperWidth) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium ${
      w === v ? "border-amber-400 bg-amber-50 text-amber-800" : "border-stone-300 text-stone-600 hover:bg-stone-50"
    }`;

  const busy = status === "connecting" || status === "printing";

  async function handleTestPrint() {
    setErrorMsg("");
    try {
      if (!printer.connected) {
        setTestStatus("connecting");
        await printer.connect();
      }
      setTestStatus("printing");
      const { formatTestPage } = await import("@/lib/printing/format-folio");
      const bytes = formatTestPage({ feedLines, qrSize });
      await printer.print(bytes);
      setTestStatus("done");
      setTimeout(() => setTestStatus("idle"), 4000);
    } catch (err) {
      setTestStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

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
      const bytes = formatFolio(folioData, { feedLines, qrSize });
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
      {/* Toolbar */}
      <div className="no-print mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500">Width:</span>
          <button type="button" onClick={() => setW("58")} className={tabBtn("58")}>58mm</button>
          <button type="button" onClick={() => setW("80")} className={tabBtn("80")}>80mm</button>

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

          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className="ml-auto text-xs text-stone-500 hover:text-stone-700 hover:underline"
          >
            {settingsOpen ? "Hide" : "Printer"} settings
          </button>
        </div>

        {/* Printer settings panel */}
        {settingsOpen && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs">
            <p className="mb-2 font-semibold text-stone-700">Printer settings (saved per device)</p>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block font-medium text-stone-600">Paper width</label>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setW("58")} className={tabBtn("58")}>58 mm</button>
                  <button type="button" onClick={() => setW("80")} className={tabBtn("80")}>80 mm</button>
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-stone-600">Feed lines before cut</label>
                <p className="mb-1 text-[10px] text-stone-400">Reduce if paper feeds too far after the receipt</p>
                <select
                  value={feedLines}
                  onChange={(e) => setFeed(parseInt(e.target.value, 10))}
                  className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs outline-none focus:border-amber-400"
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} line{n !== 1 ? "s" : ""}{n === 1 ? " (default)" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-stone-600">QR code size</label>
                <p className="mb-1 text-[10px] text-stone-400">Smaller = more compact print</p>
                <select
                  value={qrSize}
                  onChange={(e) => setQr(parseInt(e.target.value, 10))}
                  className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs outline-none focus:border-amber-400"
                >
                  {[3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>Size {n}{n === 6 ? " (default)" : ""}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Test print + link */}
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-3">
              {bluetoothSupported() ? (
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={testStatus === "connecting" || testStatus === "printing"}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    testStatus === "done"  ? "bg-emerald-600 text-white" :
                    testStatus === "error" ? "bg-rose-600 text-white hover:bg-rose-700" :
                    "bg-stone-700 text-white hover:bg-stone-800"
                  }`}
                >
                  {testStatus === "connecting" ? "Connecting…" :
                   testStatus === "printing"   ? "Printing…" :
                   testStatus === "done"       ? "✓ Test printed" :
                   testStatus === "error"      ? "⚠ Retry test" :
                   "🖨 Print test page"}
                </button>
              ) : (
                <span className="text-xs text-stone-400">Bluetooth not available — test print unavailable</span>
              )}
              <Link href="/hotel/printer-setup" className="text-xs text-amber-700 hover:underline">
                Full printer setup →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Receipt preview */}
      <div
        className="mx-auto rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-tight text-stone-900 print:rounded-none print:border-0 print:p-0 print:mx-0"
        style={{ width: w === "58" ? "58mm" : "80mm" }}
      >
        {children}
      </div>
    </div>
  );
}
