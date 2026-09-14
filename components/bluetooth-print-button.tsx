"use client";

import { useState, useCallback } from "react";
import {
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  sendBytes,
  bluetoothSupported,
} from "@/lib/printing/bluetooth-printer";
import {
  receipt,
  stickerLabel,
  idBadge,
  paymentConfirmation,
  inventoryLabel,
  customLabel,
} from "@/lib/printing/templates";
import type {
  ReceiptData,
  StickerLabelData,
  IdBadgeData,
  PaymentConfirmationData,
  InventoryLabelData,
  CustomLine,
} from "@/lib/printing/templates";

type PrintState = "disconnected" | "connecting" | "idle" | "printing" | "success" | "error";

type PrintProps =
  | { template: "receipt";             data: ReceiptData }
  | { template: "stickerLabel";        data: StickerLabelData }
  | { template: "idBadge";             data: IdBadgeData }
  | { template: "paymentConfirmation"; data: PaymentConfirmationData }
  | { template: "inventoryLabel";      data: InventoryLabelData }
  | { template: "custom";              data: CustomLine[] };

type Props = PrintProps & {
  buttonLabel?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
};

async function buildBytes(props: PrintProps): Promise<Uint8Array> {
  switch (props.template) {
    case "receipt":             return receipt(props.data);
    case "stickerLabel":        return stickerLabel(props.data);
    case "idBadge":             return idBadge(props.data);
    case "paymentConfirmation": return paymentConfirmation(props.data);
    case "inventoryLabel":      return inventoryLabel(props.data);
    case "custom":              return customLabel(props.data);
  }
}

export function BluetoothPrintButton({ buttonLabel = "Print", onSuccess, onError, ...printProps }: Props) {
  const [state, setState] = useState<PrintState>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // ─── Not a supported browser ─────────────────────────────────────────────
  if (!bluetoothSupported()) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Bluetooth printing requires Chrome or Edge on Android or Windows.
        Please switch browsers.
      </div>
    );
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleConnect = useCallback(async () => {
    setState("connecting");
    const result = await connectPrinter();
    if (result.success) {
      setDeviceName(result.deviceName);
      setState("idle");
    } else {
      setState("disconnected");
      console.error("[printer]", result.error);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnectPrinter();
    setDeviceName(null);
    setState("disconnected");
  }, []);

  const handlePrint = useCallback(async () => {
    if (!isPrinterConnected()) {
      setState("disconnected");
      return;
    }
    setState("printing");
    try {
      const bytes = await buildBytes(printProps as PrintProps);
      const result = await sendBytes(bytes);
      if (result.success) {
        setState("success");
        onSuccess?.();
        setTimeout(() => setState("idle"), 2000);
      } else {
        setErrorMsg(result.error ?? "Print failed.");
        setState("error");
        console.error("[printer]", result.error);
        onError?.(result.error ?? "Print failed.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setState("error");
      console.error("[printer]", e);
      onError?.(msg);
    }
  }, [printProps, onSuccess, onError]);

  const handleRetry = useCallback(() => {
    setErrorMsg("");
    if (isPrinterConnected()) setState("idle");
    else setState("disconnected");
  }, []);

  // ─── Render states ────────────────────────────────────────────────────────

  if (state === "disconnected") {
    return (
      <button
        type="button"
        onClick={handleConnect}
        className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
      >
        🔗 Connect Printer
      </button>
    );
  }

  if (state === "connecting") {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-400"
      >
        <Spinner /> Connecting...
      </button>
    );
  }

  if (state === "printing") {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-400"
      >
        <Spinner /> Printing...
      </button>
    );
  }

  if (state === "success") {
    return (
      <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
        ✅ Printed!
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
        >
          ❌ Failed — Retry?
        </button>
        <p className="text-xs text-rose-500">{errorMsg}</p>
      </div>
    );
  }

  // state === "idle" — connected, ready to print
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          {deviceName ?? "Printer"} Connected
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          className="text-xs text-stone-400 underline hover:text-stone-600"
        >
          Disconnect
        </button>
      </div>
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        🖨️ {buttonLabel}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
