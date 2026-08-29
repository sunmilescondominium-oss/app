"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyReferral } from "./actions";

export function VerifyReferralButton({ referralId }: { referralId: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function verify() {
    start(async () => {
      await verifyReferral(referralId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={verify}
      disabled={busy}
      className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
    >
      {busy ? "…" : "Verify"}
    </button>
  );
}
