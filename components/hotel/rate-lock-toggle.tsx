"use client";

import { useState, useTransition } from "react";
import { toggleRatePlanLock } from "@/app/(app)/hotel/rate-lock-action";

export function RateLockToggle({ enabled }: { enabled: boolean }) {
  const [busy, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function handleToggle() {
    start(async () => {
      const result = await toggleRatePlanLock(!enabled);
      if (result.ok) {
        setToast(enabled ? "Rate plan lock OFF — cashiers can select freely." : "Rate plan lock ON — room rates are now locked.");
      } else {
        setToast(result.error ?? "Toggle failed.");
      }
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <div className="no-print mb-4 flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-stone-400"}`} />
        <div>
          <span className="text-sm font-medium text-stone-800">Room rate plan lock</span>
          <span className="ml-2 text-xs text-stone-500">
            {enabled
              ? "ON — cashier cannot change the rate for rooms with an assigned plan"
              : "OFF — cashier can select any rate plan (safe mode while setting up rooms)"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {toast && (
          <span className="text-xs text-stone-600">{toast}</span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
            enabled ? "bg-emerald-500" : "bg-stone-300"
          }`}
          aria-checked={enabled}
          role="switch"
          aria-label="Toggle room rate plan lock"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
