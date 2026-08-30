"use client";

import { useState, useTransition } from "react";
import { toggleFlag } from "./actions";

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const [busy, start] = useTransition();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  function handleToggle() {
    start(async () => {
      const result = await toggleFlag(flagKey, !enabled);
      if (result.ok) {
        showToast("success", enabled ? "Flag disabled." : "Flag enabled.");
      } else {
        showToast("error", result.error ?? "Toggle failed.");
      }
    });
  }

  return (
    <div className="relative flex flex-col items-end gap-1">
      {toast && (
        <span className={`absolute -top-7 right-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium shadow-sm border ${
          toast.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {toast.type === "success" ? "✓ " : "✕ "}{toast.message}
        </span>
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
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
