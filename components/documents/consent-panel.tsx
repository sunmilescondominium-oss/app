"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { captureConsent } from "@/app/(app)/documents/actions";

export function ConsentPanel({
  buyerId,
  consentAt,
  canWrite,
}: {
  buyerId: string;
  consentAt: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function give() {
    setBusy(true);
    const r = await captureConsent(buyerId);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  if (consentAt) {
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
        ✓ Data-privacy consent captured on {new Date(consentAt).toLocaleDateString()} (RA 10173).
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <span>Data-privacy consent not captured — required before storing any government ID.</span>
      {canWrite && (
        <button
          type="button"
          onClick={give}
          disabled={busy}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Capture consent"}
        </button>
      )}
    </div>
  );
}
