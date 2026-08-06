"use client";

import { useState } from "react";
import { sendTestEmail } from "@/app/(app)/users/actions";

/** Admin diagnostic: send one test email and show the raw transport result. */
export function MailTester({ defaultTo = "" }: { defaultTo?: string }) {
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const r = await sendTestEmail(to);
      setResult(r);
    } catch (e) {
      setResult({ ok: false, detail: `client error: ${e instanceof Error ? e.message : "unknown"}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-stone-600">Test outgoing email:</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !to.trim()}
          className="rounded-lg bg-stone-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send test"}
        </button>
      </div>
      {result && (
        <p className={`mt-2 break-words rounded-lg px-3 py-2 font-mono text-xs ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {result.ok ? "✓ accepted by transport — " : "✗ "}
          {result.detail}
        </p>
      )}
    </div>
  );
}
