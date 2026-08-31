"use client";

import { useTransition, useState } from "react";
import { sendReleaseNotification } from "./actions";

export function NotifyButton({
  version,
  label,
  roles,
  alreadySent,
}: {
  version: string;
  label: string;
  roles: string[];
  alreadySent: boolean;
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(alreadySent);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    start(async () => {
      const result = await sendReleaseNotification(version, label, roles);
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error ?? "Failed to send.");
        if (result.error?.includes("already sent")) setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
        ✓ Notified
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
      >
        {pending ? "Sending…" : `🔔 Notify ${roles.length} role${roles.length !== 1 ? "s" : ""}`}
      </button>
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
    </div>
  );
}
