"use client";

import { useTransition } from "react";
import { toggleFlag } from "./actions";

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const [busy, start] = useTransition();

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => start(() => toggleFlag(flagKey, !enabled))}
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
  );
}
