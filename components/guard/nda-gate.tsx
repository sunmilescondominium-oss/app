"use client";

import { useTransition } from "react";
import { acknowledgeNda } from "@/app/(app)/guard/actions";
import { APP_LEGAL_NAME } from "@/lib/config";

export function NdaGate() {
  const [busy, start] = useTransition();

  function handleAck() {
    start(async () => {
      await acknowledgeNda();
      // acknowledgeNda() calls redirect("/guard") on success — navigation is handled server-side
    });
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-base font-bold text-stone-900">Non-Disclosure & Conduct Agreement</h2>
      <p className="mb-4 text-xs text-stone-500">
        Please read and acknowledge before accessing the guard portal.
      </p>
      <div className="mb-5 max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-relaxed text-stone-700 space-y-3">
        <p>
          As a security guard assigned to {APP_LEGAL_NAME}, you agree to:
        </p>
        <ol className="list-decimal pl-4 space-y-2">
          <li>Keep all guest, tenant, and operational information strictly confidential. You must not disclose room numbers, guest names, payment amounts, or any other property information to unauthorized persons.</li>
          <li>Use the guard portal system only for legitimate duty purposes during your assigned shift. All actions are logged and audited.</li>
          <li>Report all incidents accurately and in a timely manner. False or delayed reports are grounds for immediate suspension.</li>
          <li>Ensure every person entering the property is properly logged. Allowing unlogged entry is a serious breach of duty.</li>
          <li>Accept the authority of the property management to review all guard logs, shift reports, and handover records at any time.</li>
          <li>Understand that this system access may be revoked at any time without prior notice for any breach of these terms.</li>
        </ol>
        <p>
          By clicking "I Acknowledge" below, you confirm that you have read, understood, and agree to comply with all the terms above for the duration of your engagement with {APP_LEGAL_NAME}.
        </p>
      </div>
      <button
        type="button"
        onClick={handleAck}
        disabled={busy}
        className="w-full rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-900 disabled:opacity-60"
      >
        {busy ? "Recording acknowledgment…" : "I Acknowledge — Proceed to Guard Portal"}
      </button>
    </div>
  );
}
