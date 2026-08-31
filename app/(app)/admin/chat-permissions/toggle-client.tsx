"use client";

import { useTransition, useState } from "react";
import { toggleChatPermission } from "@/lib/chat/actions";

export function ChatPermToggle({
  roleA,
  roleB,
  enabled: initial,
}: {
  roleA: string;
  roleB: string;
  enabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, start] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    start(async () => {
      const result = await toggleChatPermission(roleA, roleB, next);
      if (!result.ok) setEnabled(!next); // revert on error
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      aria-label={enabled ? "Disable" : "Enable"}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60 ${
        enabled ? "bg-amber-600" : "bg-stone-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
