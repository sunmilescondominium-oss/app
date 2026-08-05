"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestReprint } from "@/app/(app)/forms/actions";

export function ReprintButton({ bookletId, low, requested }: { bookletId: string; low: boolean; requested: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    const note = window.prompt("Reprint request note (optional):") ?? "";
    setBusy(true);
    const res = await requestReprint(bookletId, note);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    router.refresh();
  }

  if (requested) return <span className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700">Reprint requested ✓</span>;

  return (
    <button type="button" onClick={go} disabled={busy} className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${low ? "bg-rose-600 hover:bg-rose-700" : "bg-stone-600 hover:bg-stone-700"}`}>
      {busy ? "…" : "🖨 Request reprint"}
    </button>
  );
}
