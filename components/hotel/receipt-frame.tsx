"use client";

import { type ReactNode, useState } from "react";

/** Wraps the receipt content with a 58mm/80mm width toggle for thermal POS
 *  printing + a print button. The receipt content is rendered server-side and
 *  passed as children. */
export function ReceiptFrame({ children }: { children: ReactNode }) {
  const [w, setW] = useState<"58" | "80">("58");

  const btn = (v: "58" | "80") =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium ${
      w === v ? "border-amber-400 bg-amber-50 text-amber-800" : "border-stone-300 text-stone-600"
    }`;

  return (
    <div>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-stone-500">Receipt width:</span>
        <button type="button" onClick={() => setW("58")} className={btn("58")}>
          58mm
        </button>
        <button type="button" onClick={() => setW("80")} className={btn("80")}>
          80mm
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Print receipt
        </button>
      </div>
      <div
        className="mx-auto rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-tight text-stone-900 print:rounded-none print:border-0 print:p-1"
        style={{ width: w === "58" ? "58mm" : "80mm" }}
      >
        {children}
      </div>
    </div>
  );
}
