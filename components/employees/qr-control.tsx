"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateEmployeeQr } from "@/app/(app)/employees/actions";

export function QrControl({ userId, label, hasQr }: { userId: string; label: string; hasQr: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function generate() {
    setBusy(true);
    const res = await generateEmployeeQr(userId);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  if (!hasQr) {
    return (
      <button type="button" onClick={generate} disabled={busy} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
        {busy ? "…" : "Generate QR"}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={() => setShow((v) => !v)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
        {show ? "Hide QR" : "Show QR"}
      </button>
      <button type="button" onClick={generate} disabled={busy} className="text-xs text-slate-400 hover:underline disabled:opacity-50">
        {busy ? "…" : "regen"}
      </button>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShow(false)}>
          <div className="rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 font-semibold text-slate-800">{label}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/staff/${userId}/qr`} alt={`QR for ${label}`} width={240} height={240} className="mx-auto" />
            <p className="mt-2 text-xs text-slate-400">Print this and give it to the employee as their kiosk badge.</p>
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" onClick={() => window.open(`/api/staff/${userId}/qr`, "_blank")} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900">Open / print</button>
              <button type="button" onClick={() => setShow(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
