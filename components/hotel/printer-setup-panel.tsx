"use client";

import { useState, useEffect } from "react";
import { BluetoothPrinter, bluetoothSupported } from "@/lib/printing/bluetooth-printer";

type PrintStatus = "idle" | "connecting" | "printing" | "done" | "error";
type PaperWidth = "58" | "80";

const LS_WIDTH   = "receipt_paper_width";
const LS_FEED    = "receipt_feed_lines";
const LS_QR_SIZE = "receipt_qr_size";

function lsGet(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}

export function PrinterSetupPanel() {
  const [w, setWState]             = useState<PaperWidth>("58");
  const [feedLines, setFeedState]  = useState(1);
  const [qrSize, setQrState]       = useState(6);
  const [status, setStatus]        = useState<PrintStatus>("idle");
  const [errorMsg, setErrorMsg]    = useState("");
  const [connected, setConnected]  = useState(false);
  const [printer]                  = useState(() => new BluetoothPrinter());

  useEffect(() => {
    setWState(lsGet(LS_WIDTH, "58") as PaperWidth);
    setFeedState(parseInt(lsGet(LS_FEED, "1"), 10) || 1);
    setQrState(parseInt(lsGet(LS_QR_SIZE, "6"), 10) || 6);
  }, []);

  function setW(v: PaperWidth)  { setWState(v);         lsSet(LS_WIDTH, v); }
  function setFeed(v: number)   { setFeedState(v);      lsSet(LS_FEED, String(v)); }
  function setQr(v: number)     { setQrState(v);        lsSet(LS_QR_SIZE, String(v)); }

  const tabBtn = (v: PaperWidth) =>
    `rounded-lg border px-4 py-2 text-sm font-medium ${
      w === v ? "border-amber-400 bg-amber-50 text-amber-800" : "border-stone-300 text-stone-600 hover:bg-stone-50"
    }`;

  const busy = status === "connecting" || status === "printing";

  async function handleConnect() {
    setErrorMsg("");
    try {
      setStatus("connecting");
      await printer.connect();
      setConnected(true);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function handleDisconnect() {
    printer.disconnect();
    setConnected(false);
    setStatus("idle");
    setErrorMsg("");
  }

  async function handleTestPrint() {
    setErrorMsg("");
    try {
      if (!printer.connected) {
        setStatus("connecting");
        await printer.connect();
        setConnected(true);
      }
      setStatus("printing");
      const { formatTestPage } = await import("@/lib/printing/format-folio");
      const bytes = formatTestPage({ feedLines, qrSize });
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
    status === "done"       ? "✓ Test printed" :
    status === "error"      ? "⚠ Retry test" :
    "🖨 Print test page";

  if (!bluetoothSupported()) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">Bluetooth printing not available</p>
        <p className="mt-1 text-xs">Use Google Chrome on a device with Bluetooth to print receipts wirelessly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Printer connection</h2>
        <div className="flex flex-wrap items-center gap-3">
          {connected ? (
            <>
              <span className="flex items-center gap-1.5 text-sm text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Printer connected
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "connecting" ? "Connecting…" : "Connect printer"}
            </button>
          )}
          {!connected && (
            <p className="text-xs text-stone-400">Requires Chrome + Bluetooth thermal printer (ESC/POS)</p>
          )}
        </div>
        {status === "error" && errorMsg && (
          <p className="mt-2 text-xs text-rose-600">{errorMsg}</p>
        )}
      </section>

      {/* Paper settings */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-stone-700">Paper settings <span className="font-normal text-stone-400">(saved per device)</span></h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-stone-600">Paper width</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setW("58")} className={tabBtn("58")}>58 mm</button>
              <button type="button" onClick={() => setW("80")} className={tabBtn("80")}>80 mm</button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Feed lines before cut</label>
            <p className="mb-2 text-xs text-stone-400">Reduce if paper feeds too far after the receipt prints</p>
            <select
              value={feedLines}
              onChange={(e) => setFeed(parseInt(e.target.value, 10))}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-400"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} line{n !== 1 ? "s" : ""}{n === 1 ? " (default)" : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">QR code size</label>
            <p className="mb-2 text-xs text-stone-400">Larger = easier to scan; smaller = more compact print</p>
            <select
              value={qrSize}
              onChange={(e) => setQr(parseInt(e.target.value, 10))}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-400"
            >
              {[3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>Size {n}{n === 6 ? " (default)" : ""}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Test print */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-stone-700">Test print</h2>
        <p className="mb-4 text-xs text-stone-400">Prints a test alignment page with the current settings. Use this to verify paper width, feed lines, and QR size before printing real receipts.</p>
        <button
          type="button"
          onClick={handleTestPrint}
          disabled={busy}
          className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            status === "done"  ? "bg-emerald-600 text-white" :
            status === "error" ? "bg-rose-600 text-white hover:bg-rose-700" :
            "bg-stone-800 text-white hover:bg-stone-900"
          }`}
        >
          {printLabel}
        </button>
        {status === "error" && errorMsg && (
          <p className="mt-2 text-xs text-rose-600">{errorMsg}</p>
        )}
        {status === "done" && (
          <p className="mt-2 text-xs text-emerald-700">Test page sent to printer. Check alignment and adjust settings if needed.</p>
        )}
      </section>
    </div>
  );
}
