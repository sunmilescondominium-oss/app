"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateEmployeeQr, setEmployeeQrCode } from "@/app/(app)/employees/actions";

export function QrControl({ userId, label, qrToken }: { userId: string; label: string; qrToken: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function act(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setCode("");
    router.refresh();
  }

  async function copy() {
    if (!qrToken) return;
    await navigator.clipboard?.writeText(qrToken).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
        {qrToken ? "QR code ✓" : "QR code"}
      </button>
    );
  }

  return (
    <div className="w-64 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left">
      {qrToken && (
        <div className="mb-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Badge code</span>
          <div className="flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-1.5 py-1 text-[11px] text-slate-700" title={qrToken}>{qrToken}</code>
            <button type="button" onClick={copy} className="rounded border border-slate-300 px-1.5 py-1 text-[11px] hover:bg-white">{copied ? "✓" : "copy"}</button>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">Paste this into any QR/ID maker, or print below.</p>
        </div>
      )}

      <div className="mb-1 flex gap-1">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="set custom code"
          className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-1 text-[11px] outline-none focus:border-amber-500"
        />
        <button type="button" onClick={() => act(() => setEmployeeQrCode(userId, code))} disabled={busy || code.trim().length < 6} className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
          Save
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => act(() => generateEmployeeQr(userId))} disabled={busy} className="rounded border border-slate-300 px-2 py-1 text-[11px] hover:bg-white">
          Random
        </button>
        {qrToken && (
          <button type="button" onClick={() => setShowQr(true)} className="rounded border border-slate-300 px-2 py-1 text-[11px] hover:bg-white">
            Show / print QR
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="ml-auto text-[11px] text-slate-400 hover:underline">
          close
        </button>
      </div>

      {showQr && qrToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowQr(false)}>
          <div className="rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 font-semibold text-slate-800">{label}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/staff/${userId}/qr`} alt={`QR for ${label}`} width={240} height={240} className="mx-auto" />
            <p className="mt-2 text-xs text-slate-400">Print and give to the employee as their kiosk badge.</p>
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" onClick={() => window.open(`/api/staff/${userId}/qr`, "_blank")} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900">Open / print</button>
              <button type="button" onClick={() => setShowQr(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
